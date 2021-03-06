import Bot from './Bot.js';
import Store from '../stores/Store.js';
import UserStore from '../stores/UserStore.js';
import ChannelStore from '../stores/ChannelStore.js';
import GameStore from '../stores/GameStore.js';
import Game from '../models/Game.js';
import User from '../models/User.js';

export default class Waldner {

  constructor( name, token, api ) {
    this.name = name;
    this.bot = new Bot( name, token );
  }

  run() {
    console.log('Waldner iz alive!');
    this.setupListeners();
    this.bot.init();
  }

  setupListeners() {

    // Rank player, with player id optional
    this.bot.hears( /rank(\ \<\@(\S+)\>)?(\ all\ time)?/i, ( message, userPresent, userId, allTime ) => {

      userId = userId || message.user;
      this.getRankForUser( userId, responseString => {
        this.bot.respond( message, responseString, 'medal' );
      }, allTime);

    });

    // Responds with the ladder
    this.bot.hears( /ladder(\ all\ time)?/i, ( message, allTime ) => {
      this.getLadder( (responseString) => {
        this.bot.respond( message, responseString, 'medal' );
      }, allTime );
    });

    // List games
    this.bot.hears( /games(\ \<\@(\S*)\>)?/i, ( message, userPresent, userId ) => {
      // TODO: Handle player games
      let games = new GameStore();
      games.fetch()
        .then( () => {
          this.bot.respond( message, 'Senaste matcherna :table_tennis_paddle_and_ball:\n'+games.prettyPrint(), 'happy' );
        })
        .catch( () => {
          this.bot.respond( message, 'Kunde inte hämta matcher :cry:' );
        })
    });

    this.bot.hears( /stats(\ \<\@(\S*)\>)?/i, (message, userPresent, userId) => {
      userId = userId || message.user;
      this.getUser( userId, user => {
        this.bot.respond( message, user.printStats() );
      }, error => {
        this.bot.respond( message, error );
      })
    });

    // Save a game
    this.bot.hears( /\<\@(\S*)\>\ \<\@(\S*)\>\ (\d+[\ |-]\d+.*)/i, ( message, firstUserId, secondUserId, sets) => {
      sets = sets.replace(',', ' ').replace('  ', ' ').split(' ');

      let firstUser = new User( this.bot.getUser( firstUserId ) );
      let secondUser = new User( this.bot.getUser( secondUserId ) );

      console.log(firstUser);

      let scores = sets.map( (set) => {
        let s1 = set.split('-')[0];
        let s2 = set.split('-')[1];
        return { set: [ s1, s2 ]};
      });

      new Game({
        players: [
          firstUser.getPropsForGame(),
          secondUser.getPropsForGame()
        ],
        sets: scores
      }).save()
      .then(() => {
        this.bot.respond( message, ':table_tennis_paddle_and_ball: Matchen sparades! :table_tennis_paddle_and_ball:', 'happy');
      })
      .catch(() => {
        this.bot.respond( message, 'Kunde inte spara matchen :crying_cat_face:');
      });

    });

    this.bot.hears(/help/i, (message) => {
      this.bot.respond( message, 'Hahahahahahaaaaaa.. Fuck off');
    });

    this.bot.hears(/^waldner$/i, (message) => {
      let quotes = [
        'Vet du vad det sjukaste är?\nNär jag möter folk på gatan säger fem av tio fortfarande Kungen.',
        'Medaljerna tänkte jag skicka till ett museum i Köping, men de fick inte plats så nu ligger de i påsar.',
        'Jag var tvungen att sätta ett bunkerslag på 25 meter och "Tickan" sa till mig: "Sätter du det här slaget har du fri dricka i resten av ditt liv".\nJa, ja sa jag, pang mot flaggan och rakt i',
        'Går jag in i en taxi i Kina säger chauffören: "Tja Lao Wa! Läget?".\nJag är halvkines och på slutet fick jag lika mycket stöd som den kines jag mötte.',
        'Alla kineser jag möter och alla som är med dem, ska ta kort innan matcherna. För dem är det lika viktigt som att spela, och det är rätt häftigt. De vill ha något att visa upp i Kina.',
        'Jag tycker att det är bättre ljus här i hallen, än när det är dåligt ljus.'
      ];
      let rand = Math.floor(Math.random() * quotes.length );
      this.bot.respond( message, quotes[ rand ], 'happy' );
    });

  }

  getLadder( callback, allTime) {

    console.log('ALL TIME', allTime);

    let topPlayers = new Store();
    topPlayers.fetch('players/top?include=stats')
      .then( () => {
        let str = ':trophy: Veckans topplista :trophy:\n```';
        if ( allTime ) { str = ':trophy: Maratonlista :trophy:\n```'; }
        for (let i = 0; i < topPlayers.models.length; i++) {
          let p = topPlayers.models[i];
          let rating = p.get('ratings').weekly;
          let wins = p.get('stats').wins;
          let losses = p.get('stats').loses;
          if (allTime) { rating = p.get('ratings').all_time; }
          str += `${i+1}. ${p.get('name')} (${rating}): ${wins}-${losses}\n`;
        }
        str += '```';
        callback( str );
      })
      .catch( (err) => {
        console.log('Could not fetch ladder', err);
        callback( 'Kunde inte hämta topplistan :tired_face:' );
      })
  }

  getRankForUser( userId, callback, allTime ) {
    let user = new User({id: userId});

    console.log('user id', userId);
    user.fetch( process.env.API_BASE + 'players/' + userId + '?include=stats' )
      .then( ( data ) => {
        let ratings = user.get('ratings');
        let ladderscore = ratings.weekly;
        let ranks = user.get('rank');
        let rank = ranks.weekly;
        if ( allTime ) {
          ladderscore = ratings.all_time;
          rank = ranks.all_time;
        }

        let emoji = '';
        if (rank == 1) { emoji = ':party::sports_medal::trophy:'; }

        callback( `@${user.get('slack_name')} har ladder score ${ladderscore} och ligger på plats ${rank} ${emoji}` );
      })
      .catch( (error) => {
        callback('Kunde inte hämta spelare :cry: ' + error);
      });
  }

  getUser( userId, successCallback, errorCallback ) {
    let user = new User({id: userId});
    console.log('uid', userId);
    user.fetch( process.env.API_BASE + 'players/' + userId + '?include=stats' )
      .then( (data) => {
        successCallback( user );
      })
      .catch( error => {
        errorCallback('Kunde inte hämta spelare ' + error);
      })
  }

}
