/**
 * Created by danielr on 10/12/16.
 */
var builder = require('botbuilder');
var restify = require('restify');
var engine = require('./engine/engine');
var utils = require('./js/utils');
var Chess = require('chess.js').Chess;
var qs = require("querystring");

var chess = new Chess();


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());


//=========================================================
// Activity Events  (skype only)
//=========================================================

bot.on('conversationUpdate', function (message) {
    // Check for group conversations
    if (message.address.conversation.isGroup) {
        // Send a hello message when bot is added
        if (message.membersAdded) {
            message.membersAdded.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                        .address(message.address)
                        .text("Hello everyone! I'm your chess buddy ;)");
                    bot.send(reply);
                }
            });
        }

        // Send a goodbye message when bot is removed
        if (message.membersRemoved) {
            message.membersRemoved.forEach(function (identity) {
                if (identity.id === message.address.bot.id) {
                    var reply = new builder.Message()
                        .address(message.address)
                        .text("Goodbye");
                    bot.send(reply);
                }
            });
        }
    }
});

bot.on('contactRelationUpdate', function (message) {
    if (message.action === 'add') {
        var name = message.user ? message.user.name : null;
        var reply = new builder.Message()
            .address(message.address)
            .text("Hello %s... Thanks for adding me. I'm chessyBot, your chess buddy! Say 'hi' to see some great demos.", name || 'there');
        bot.send(reply);
    } else {
        // delete their data
    }
});

bot.on('deleteUserData', function (message) {
    // User asked to delete their data
});

//=========================================================
// Bots Middleware
//=========================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));

//=========================================================
// Bots Global Actions
//=========================================================

bot.endConversationAction('goodbye', 'Goodbye :)', { matches: /^goodbye/i });
bot.beginDialogAction('help', '/help', { matches: /^help/i });

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [
    function (session) {
        // Send a greeting and show help.
        var card = new builder.HeroCard(session)
            .title("ChessyBot - your chess buddy")
            .text("Let me help you with your next move!")
            .images([
                builder.CardImage.create(session, "https://placeholdit.imgix.net/~text?txtsize=35&txt=ChessyBot&w=300&h=160")
            ]);
        var msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.send("Hi... I'm ChessyBot. Let me help you to make the next winning move!");
        session.beginDialog('/help');
    },
    function (session, results) {
        // Display menu
        session.beginDialog('/menu');
    },
    function (session, results) {
        // Always say goodbye
        session.send("Ok... See you later!");
    }
]);

bot.dialog('/help', [
    function (session) {
        session.endDialog("Global commands that are available anytime:\n\n* menu - Exits a demo and returns to the menu.\n* goodbye - End this conversation.\n* help - Displays these commands.");
    }
]);

bot.dialog('/menu', [
    function (session) {
         builder.Prompts.choice(session, "How would you like me to predict your next move?", "fen|pgn|(quit)");
    },
    function (session, results) {
        if (results.response && results.response.entity != '(quit)') {
            // Launch engine dialog
            session.beginDialog('/' + results.response.entity);
        } else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]).reloadAction('reloadMenu', null, { matches: /^menu|show menu/i });

bot.dialog('/fen', [
    function (session) {
        session.beginDialog('/validate_fen', {
            prompt: "Please enter the FEN of your current board. Example: rnbqkb1r/pp3ppp/4pn2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR w KQkq -",
            retryPrompt: "Let's try again..."
        });
    },
    function (session, results) {
        if (results.response){
            var fen = utils.normalizeFen(results.response);
            session.beginDialog('/compute', {situation: fen});
        }
        else{
            session.beginDialog("/no_situation");
        }
    }

]);

bot.dialog('/validate_fen', builder.DialogAction.validatedPrompt(builder.PromptType.text, function (response) {
    var fen = utils.normalizeFen(response);
    var result = chess.validate_fen(fen);
    var isValid = result.valid;
    ///TODO: currently prints the validation error message in the console as I did not find a way to to it with validatedPrompt
    ///maybe a workaround is implement my own by using the confirm prompt with a retry mechanism
    if (!isValid){
        console.log("FEN validation error for " + response + ": " + result.error);
    }
    return isValid;
}));

bot.dialog('/pgn', [
    function (session) {
        session.beginDialog('/validate_pgn', {
            prompt: "please enter the moves history using the pgn format (with or without header, sloppy or not). Example: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O",
            retryPrompt: "Let's try again..."
        });
    },
    function (session, results) {
        if (results.response){
            var isOk = chess.load_pgn(results.response);
            if (isOk){
                var situation = chess.fen();
                session.beginDialog('/compute', {situation: situation});
            }
            else {
                session.beginDialog("/no_situation");
            }
        }
        else{
            session.beginDialog("/no_situation");
        }
    }
]);

bot.dialog('/validate_pgn', builder.DialogAction.validatedPrompt(builder.PromptType.text, function (response) {
    var isValid = chess.load_pgn(response);
    return isValid;
}));

bot.dialog("/no_situation", function(session){
    session.send("I'm sorry, I could not load the game according your input.");
    session.send("Don't worry, you still can try with another format from the menu");
    session.endDialog();
});

bot.dialog('/compute',function(session, args){
    session.send("ok. let me check the next best move for you....");
    //session.userData.situation = args.situation;
    engine
        .nextMove(args.situation)
        .then((result) => {
            session.send("I suggest you that one: %s", result.nextMove);
            //session.userData.prediction = result;
            var isFen = args.situation.indexOf("/") > -1;
            if (isFen){
                session.beginDialog('/show_board', {fen: args.situation, prediction: result.nextMove, nextOpponentMove: result.nextOpponentMove});
            }
            else {
                session.beginDialog('/opponent', {nextOpponentMove: result.nextOpponentMove});
            }
            // End
            session.endDialog();
        });
});

bot.dialog('/show_board',function(session, args){
    var fen = args.fen;
    var prediction = args.prediction;

    /*var match = fen.match(/\S+/gi);
    var url = "https://en.lichess.org/analysis/standard/" + match[0] + "_" + match[1];*/

    //for some reason the url below issues a bad request. probably because of the slash chars

    ///for some reasons building a link with more than two query params does not work
    ///TODO: submit the issue in git
    var data = fen + " " + prediction;
    var url = process.env.CHESSY_WEB_PATH + "?" + qs.stringify({data: data});
    //without passing the fen it's ok
    //var url = process.env.CHESSY_WEB_PATH + "?" + qs.stringify({move: prediction});
    //var url = process.env.CHESSY_WEB_PATH + "?" + qs.stringify({fen: fen.replace("/", "_"), move: prediction});

    /*var encoded_fen = utils.replaceAll(fen, "/", "_");
    var encoded_fen = utils.replaceAll(encoded_fen, " ", "");
    var encoded_fen = utils.replaceAll(encoded_fen, "-", "");
    var url = process.env.CHESSY_WEB_PATH + "?fen=" + encoded_fen + "&move=" + prediction;*/

    console.log("url: " + url);
    session.send("let me show this on the <a href='%s'>chessboard</a>!", url);
    session.beginDialog('/opponent', {prediction: args.nextOpponentMove});
});

bot.dialog('/opponent',function(session, args){
    session.send("by the way the best move for your opponent right after your move is %s...", args.prediction);
});

