/**
 * Created by danielr on 10/12/16.
 */
var builder = require('botbuilder');
var restify = require('restify');
var engine = require('./engine/engine');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
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
        builder.Prompts.choice(session, "How would you like me to predict your next move?", "fen|moves|(quit)");
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
        //session.send("please enter the FEN text. Leave empty for the initial chess game. Example: rnbqkb1r/pp3ppp/4pn2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR w KQkq -");
        builder.Prompts.text(session, "please enter the FEN of your current board. Leave empty for the initial chess game. Example: rnbqkb1r/pp3ppp/4pn2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR w KQkq -");
    },
    function (session, results) {
        ///TODO: perform FEM validation step here
        session.beginDialog('/compute', {situation: results.response});
    }

]);

bot.dialog('/moves', [
    function (session) {
        //session.send("please enter the FEN text. Leave empty for the initial chess game. Example: rnbqkb1r/pp3ppp/4pn2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR w KQkq -");
        builder.Prompts.text(session, "please enter the moves history. Leave empty for the initial chess game. Example: e2e4 e7e5 g1f3 b8c6 f1c4");
    },
    function (session, results) {
        ///TODO: perform moves validation step here
        session.beginDialog('/compute', {situation: results.response});
    }

]);

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
                session.beginDialog('/show_board', {fen: args.situation, prediction: result});
            }
            else {
                session.beginDialog('/opponent', {prediction: result});
            }
            // End
            session.endDialog();
        });
});

bot.dialog('/show_board',function(session, args){
    session.send("does not look familiar to you? let me show it on a board...");
    var fen = args.fen;
    var match = fen.match(/\S+/gi);
    var url = "https://en.lichess.org/analysis/" + match[0] + "_" + match[1];
    session.send("just click <a href='%s'>here</a>!", url);
});

