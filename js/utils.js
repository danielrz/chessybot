/**
 * Created by danielr on 10/12/16.
 */

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
    }
};