/**
 * Created by danielr on 10/12/16.
 */
var qs = require("querystring");

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
    }
};