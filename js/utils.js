/**
 * Created by danielr on 10/12/16.
 */
var qs = require("querystring");
var Promise = require('bluebird');
var Client = require('node-rest-client').Client;

module.exports = {
    replaceAll: function (str, find, replace) {
        function escapeRegExp(str) {
            return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        }
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    },

    normalizeFen: function(fen){
        var tokens = fen.split(/\s+/);

        if (!(tokens.length >= 2 && tokens.length <= 6)){
            return fen;
        }

        if (tokens.length < 6){
            var FEN_DEFAULT_MISSING_PARTS = ["KQkq", "-", 0, 1];
            for (var i = tokens.length; i < 6; i++){
                fen = fen + " " + FEN_DEFAULT_MISSING_PARTS[i - 2];
            }
        }
        return fen;
    },

    getChessyWebUrl: function(fen, prediction){
        ///for some reasons building a link with more than two query params does not work
        ///TODO: submit the issue in git
        var data = (prediction === null || prediction === "") ? fen : fen + " " + prediction;
        var basePath = process.env.USE_CHESSY_WEB_TUNNEL ? process.env.CHESSY_WEB_PATH_TUNNEL : process.env.CHESSY_WEB_PATH_DEV;
        var url = basePath + "?" + qs.stringify({data: data});
        return url;
    },

    getUrlFromLink: function(code){
        var hrefRegEx = /href="([^"]*)"/gi;
        var hrefValueRegEx = /".+"/gi;
        var result = code;
        var href = code.match(hrefRegEx);
        if (href && href.length > 0) {
            var hrefVal = href[0].match(hrefValueRegEx);
            if (hrefVal && hrefVal.length > 0){
                result = hrefVal[0].substring(1, (hrefVal[0].length - 1));
            }
        }
        return result;
    },

    getFENPrediction: function(imageUrl, side){
        return new Promise(function (resolve) {
            var client = new Client();

            // set content-type header and data as json in args parameter
            var args = {
                parameters: { img_url: imageUrl, side: side },
                headers: { "Content-Type": "application/json" }
            };

            client.post(process.env.CHESSY_TENSORFLOW_API_PROD, args, function (data, response) {
                // parsed response body as js object
                console.log(data);
                // raw response
                //console.log(response);

                resolve(data);
            });
        });
    },

    getMessageByCertainty: function(certainty){
        var msg = "";
        if (certainty > 90){
           msg = "I'm pretty confident I successfully recognized all the tiles in the chessboard! Let's go on and let me compute what's the next best move for you...";
        }
        else if (certainty > 70 && certainty <= 90){
            msg = "I successfully recognized all the tiles but you'd better check if I did not make a minor mistake... Let me anyway compute what's the next best move for you..."
        }
        else if (certainty > 50 && certainty <= 70){
            msg = "I might partially have successfully recognized all the tiles and you'd better check if I did not make a mistake... Let me anyway compute what's the next best move for you..."
        }
        else if (certainty > 25 && certainty <= 50){
            msg = "I did not recognize all the tiles and you'd better check if I did not make a mistake... Check the quality of the picture and if it is cropped correctly.  Let me anyway compute what's the next best move for you according what I found..."
        }
        else if (certainty >= 25){
            msg = "Something went wrong and I could not recognize all the tiles. You'd better check if I did not make a mistake... Check the quality of the picture and if it is cropped correctly.  Let me anyway compute what's the next best move for you according what I found..."
        }
        return msg;
    }
};