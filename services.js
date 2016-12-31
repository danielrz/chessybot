/**
 * Created by danielr on 10/12/16.
 * Not in use. Use the bot node js to handle post message form chessyweb
 */
var restify = require('restify');
var engine = require('./engine/engine');

// Setup Restify Server
var server = restify.createServer();

server
    .use(restify.fullResponse())
    .use(restify.bodyParser());

server.listen(process.env.port || process.env.PORT || 3980, function () {
    console.log('%s listening to %s', server.name, server.url);
});

server.post("/analyze", analyzeFen);

function analyzeFen(req, res, next) {
    var fen = req.body.fen || req.body;
    console.log("fen: " + fen);
    engine
        .nextMove(fen)
        .then((result) => {
            var isFen = fen.indexOf("/") > -1;
            if (isFen){
                res.json({
                    fen: fen,
                    prediction: result.nextMove,
                    nextOpponentMove: result.nextOpponentMove,
                    nextMateMove: result.nextMateMove});
            }
            else {
                res.status(500);
            }
        });

}


