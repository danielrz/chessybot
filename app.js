/**
 * Created by danielr on 10/12/16.
 */
var builder = require('botbuilder');
var restify = require('restify');
var engine = require('./engine/engine');
var Promise = require('bluebird');
var request = require('request-promise').defaults({ encoding: null });
var uuid = require('node-uuid');
var unirest = require('unirest');
var utils = require('./js/utils');
var fs = require("fs");
var Chess = require('chess.js').Chess;

var PLAYER_COLOR = {
    BLACK: "BLACK",
    WHITE: "WHITE"
};

var chess = new Chess();


// Setup Restify Server
var server = restify.createServer();
server
    .use(restify.fullResponse())
    .use(restify.bodyParser());

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

server.post("/analyze", utils.analyzeFen);

//var expression = "/\/puzzles\/?.*/";
//var rx = RegExp(expression,'i');

server.get(/\/puzzles\/?.*/, restify.serveStatic({
//server.get(expression, restify.serveStatic({
    directory: './img'
}));

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
         builder.Prompts.choice(session, "How would you like me to predict your next move?", "pic|fen|pgn|(quit)");
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

bot.dialog('/pic', [
    function (session) {
        builder.Prompts.choice(session, "How would you like to send the picture (by url or by taking a picture)?", "picByUrl|picByFile|(quit)");
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

]);

bot.dialog('/picByUrl', [
    function (session) {
        builder.Prompts.text(session, "tell me what is the url of your board. Example: http://i.imgur.com/HnWYt8A.png");
    },
    function (session, results) {
        session.userData.fileName = "";
        session.userData.imgUrl = utils.getUrlFromLink(results.response);
        session.beginDialog("/picByUrlNext");
    }
]);

bot.dialog('/picByUrlNext', [
    function (session) {
        builder.Prompts.choice(session, "Is it the turn to white (w) or black (b) to play?", "w|b|(quit)");
    },
    function (session, results) {
        if (results.response && results.response.entity != '(quit)') {
            // Launch engine dialog
            session.userData.side = results.response.entity;
            session.beginDialog('/predictFen');
        } else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]);

bot.dialog('/predictFen', [
    function(session){
        utils
            .getFENPrediction(session.userData.imgUrl, session.userData.fileName, session.userData.side)
            .then((result) => {
                console.log(result);
                var fen = "";
                var certainty = 0;
                if (result && result.result && result.result.length > 0){
                    var res = result.result[0];
                    fen = res.fen;
                    certainty = res.certainty;
                    session.beginDialog('/compute', {fen: fen, certainty: certainty});
                }
                //session.endDialog();
            });
    }
]);

bot.dialog('/picByFile', [
    function (session) {
        builder.Prompts.attachment(session, "please upload a screenshot of your board");
    },
    function (session, results) {
        var msg = new builder.Message(session)
            .ntext("I got %d attachment.", "I got %d attachments.", results.response.length);
        session.send(msg);

        if (results.response.length) {
            var attachment = results.response[0];
            if (attachment.contentType.indexOf("image") > -1){
                var fileDownload = isSkypeMessage(msg) ? requestWithToken(attachment.contentUrl): request(attachment.contentUrl);
                fileDownload.then(
                    function (response) {
                        // Send reply with attachment type & size
                        var reply = new builder.Message(session)
                            .text('Attachment of %s type and size of %s bytes received.', attachment.contentType, response.length);
                        session.send(reply);
                        var fileName = uuid.v1() + ".png"; //will work even if original file is jpg
                        var path = "./img/puzzles/" + fileName;
                        fs.writeFile(path, response, "binary", function (err) {
                            console.log("upload of file " + fileName + "done. result: " + err);
                            var imgUrl = process.env.CHESSY_BOT_PROD + process.env.CHESSY_BOT_IMG_PATH + "/" + fileName;
                            session.userData.imgUrl = imgUrl;
                            session.beginDialog("/picByUrlNext");
                            //below is not necessary for this time
                            /*unirest.post(process.env.CHESSY_TENSORFLOW_API_PROD + process.env.CHESSY_TENSORFLOW_UPLOAD_PATH)
                                .headers({'Content-Type': 'multipart/form-data'})
                                //.field('parameter', 'value') // Form field
                                .attach('puzzle', path) // Attachment
                                .end(function (response) {
                                    console.log(response.body);
                                    if (response.code === 200){
                                        session.userData.imgUrl = "";
                                        session.userData.fileName = fileName;
                                        session.beginDialog("/picByFileNext");
                                    }
                                });*/
                        });

                    }).catch(function (err) {
                    console.log('Error downloading attachment:', { statusCode: err.statusCode, message: err.response.statusMessage });
                });
            }
            else {
                var reply = new builder.Message(session)
                    .text('Sorry but I understand only images with a png or jpg extension');
                session.send(reply);
                session.replaceDialog('/menu');
            }
        }
        else {

            // No attachments were sent
            var reply = new builder.Message(session)
                .text('Sorry but no attachment was sent to me. Please try again sending a new message with an attachment.');
            session.send(reply);
            session.replaceDialog('/menu');
        }

    }
]);

bot.dialog('/picByFileNext', [
    function (session){
        builder.Prompts.choice(session, "Is it the turn to white (w) or black (b) to play?", "w|b|(quit)");
    },
    function (session, results) {
        if (results.response && results.response.entity != '(quit)') {
            // Launch engine dialog
            session.userData.side = results.response.entity;
            session.beginDialog('/predictFen');
        } else {
            // Exit the menu
            session.endDialog();
        }
    },
    function (session, results) {
        // The menu runs a loop until the user chooses to (quit).
        session.replaceDialog('/menu');
    }
]);

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
            session.beginDialog('/compute', {fen: fen});
        }
        else{
            session.beginDialog("/no_fen");
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
                var fen = chess.fen();
                session.beginDialog('/compute', {fen: fen});
            }
            else {
                session.beginDialog("/no_fen");
            }
        }
        else{
            session.beginDialog("/no_fen");
        }
    }
]);

bot.dialog('/validate_pgn', builder.DialogAction.validatedPrompt(builder.PromptType.text, function (response) {
    var isValid = chess.load_pgn(response);
    return isValid;
}));

bot.dialog("/no_fen", function(session){
    session.send("I'm sorry, I could not load the game according your input.");
    session.send("Don't worry, you still can try with another format from the menu");
    session.endDialog();
});

bot.dialog('/compute',function(session, args){
    var certainty = args.certainty;
    if (certainty){
        var msg_certainty = utils.getMessageByCertainty(certainty);
        session.send(msg_certainty);
    }
    else {
        session.send("ok. let me check the next best move for you....");
    }
    var fen = utils.normalizeFen(args.fen);
    //if (chess.load(fen) === true){  //not clear from the doc when it fails if boolean only or not
    chess.load(fen);
    if (chess.game_over()){
        var message = "Ouch! it seems like the game is over! ";
        var playerColor = chess.turn() === "b" ? PLAYER_COLOR.BLACK : PLAYER_COLOR.WHITE;
        var url = utils.getChessyWebUrl(fen, "");
        if (chess.in_checkmate()){
            message = message + playerColor + " won by <a href='" + url + "'>check mate</a>...";
        }
        else if (chess.in_draw()){
            message = message + "this is a <a href='" + url + "'>draw</a> between BLACK and WHITE!";
        }
        else if (chess.in_stalemate()){
            message = message + "this is a <a href='" + url + "'>draw (stalemate)</a> between BLACK and WHITE!";
        }
        session.send(message);
        //session.endDialog();
    }
    else {
        engine
            .nextMove(fen)
            .then((result) => {
                var isFen = fen.indexOf("/") > -1;
                if (isFen){
                    session.beginDialog("/show_board", {fen: fen, prediction: result.nextMove, nextOpponentMove: result.nextOpponentMove, nextMateMove: result.nextMateMove});
                }
                //session.endDialog();
            });
    }
    /*}
    else {
        session.beginDialog("/no_fen");
    }*/
});

bot.dialog('/show_board',function(session, args){
    var fen = args.fen;
    var prediction = args.prediction;
    var nextOpponentMove = args.nextOpponentMove;
    var nextMateMove = args.nextMateMove;

    var url = utils.getChessyWebUrl(fen, prediction);

    console.log("url: " + url);
    if (typeof nextMateMove !== "undefined" && nextMateMove !== null && !isNaN(nextMateMove)){
        session.send("First you should be concerned that a MATE can be done in <strong>%s moves</strong> here!!!", nextMateMove);
    }
    session.send("May I suggest you for your next move: <a href='%s'>%s</a>", url, prediction);
    //session.send("let me show this on the <a href='%s'>chessboard</a>!", url);
    if (nextOpponentMove){
        session.beginDialog('/opponent', {fen: fen, prediction: prediction, nextOpponentMove: nextOpponentMove});
    }
    session.endDialog();
});

bot.dialog('/opponent',function(session, args){
    var fen = args.fen;
    var prediction = args.prediction;
    var nextOpponentMove = args.nextOpponentMove;
    var from = prediction.substring(0, 2);
    var to = prediction.substring(2, 4);
    chess.move({from: from, to: to});
    fen = chess.fen();

    var url = utils.getChessyWebUrl(fen, nextOpponentMove);

    console.log("opponent url: " + url);
    session.send("by the way the best move for your opponent right after my suggested move is  <a href='%s'>%s</a>", url, nextOpponentMove);

});

// Request file with Authentication Header
var requestWithToken = function (url) {
    return obtainToken().then(function (token) {
        return request({
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/octet-stream'
            }
        });
    });
};

// Promise for obtaining JWT Token (requested once)
var obtainToken = Promise.promisify(connector.getAccessToken.bind(connector));

var isSkypeMessage = function (message) {
    return message.data.source === 'skype';
};

