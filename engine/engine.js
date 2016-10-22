/**
 * Created by danielr on 10/12/16.
 */
var Promise = require('bluebird');
var stockfish = require("../lib/stockfish.js");

var DEFAULT_ANALYZING_TIME = 10000;
var MAX_NEXT_MATE_MOVE = 1000;

var engine = stockfish();

module.exports = {
    nextMove: function (situation) {
        return new Promise(function (resolve) {

            var position = "startpos";
            var got_uci;
            var got_ready;
            var started_thinking;
            var next_mate_move = MAX_NEXT_MATE_MOVE;

            function send(str) {
                console.log("Sending: " + str)
                engine.postMessage(str);
            }

            engine.onmessage = function (line) {
                var match;
                console.log("Line: " + line)

                if (typeof line !== "string") {
                    console.log("Got line:");
                    console.log(typeof line);
                    console.log(line);
                    return;
                }

                if (!got_uci && line === "uciok") {
                    got_uci = true;
                    send("isready");
                }
                else if (got_uci && !got_ready && line === "uciokreadyok"){
                    got_ready = true;
                    if (position){
                        send("position " + position);
                        //send("eval");
                        send("d");
                    }
                    send("go ponder");
                    //send("go mate 3"); //this CPU and time consuming. do not use it!
                }
                else if (!started_thinking && line.indexOf("info depth") > -1) {
                    console.log("Thinking...");
                    started_thinking = true;
                    send("go movetime " + DEFAULT_ANALYZING_TIME);

                } else if (line.indexOf("bestmove") > -1) {
                    match = line.match(/bestmove\s+(\S+)/);
                    if (match) {
                        var result = {};
                        result.nextMove = match[1];
                        console.log("Best move: " + result.nextMove);
                        match = line.match(/ponder\s+(\S+)/);
                        if (match) {
                            result.nextOpponentMove = match[1];
                            console.log("Next opponent move: " + result.nextOpponentMove);
                        }
                        if (next_mate_move < MAX_NEXT_MATE_MOVE){
                            result.nextMateMove = next_mate_move;
                        }
                        resolve(result);
                    }

                }
                else if (line.indexOf("score mate ") > -1){
                    match = line.match(/score mate [0-9]+/);
                    match = match[0].match(/[0-9]+/);
                    var mate = parseInt(match[0], 10);
                    if (mate < next_mate_move){
                        next_mate_move = mate;
                    }
                }
            };

            (function get_position() {
                if (situation.indexOf("/") > -1) {
                    position = "fen " + situation;
                } else {
                    position = "startpos moves " + situation;
                }
            }());

            send("uci");

        });
    }

};