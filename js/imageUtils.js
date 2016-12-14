/**
 * Created by danielr on 12/14/16.
 */

var needle = require("needle");
var url = require('url');

//module.exports = {
    const hasImageAttachment = session => {
        return ((session.message.attachments.length > 0) && (session.message.attachments[0].contentType.indexOf("image") !== -1));
    }

    const getImageStreamFromUrl = attachment => {
        var headers = {};
        if (isSkypeAttachment(attachment)) {
            // The Skype attachment URLs are secured by JwtToken,
            // you should set the JwtToken of your bot as the authorization header for the GET request your bot initiates to fetch the image.
            // https://github.com/Microsoft/BotBuilder/issues/662
            connector.getAccessToken((error, token) => {
                var tok = token;
                headers['Authorization'] = 'Bearer ' + token;
                headers['Content-Type'] = 'application/octet-stream';

                return needle.get(attachment.contentUrl, { headers: headers });
            });
        }

        headers['Content-Type'] = attachment.contentType;
        return needle.get(attachment.contentUrl, { headers: headers });
    }

    const isSkypeAttachment = attachment => {
        if (url.parse(attachment.contentUrl).hostname.substr(-"skype.com".length) == "skype.com") {
            return true;
        }

        return false;
    }

    /**
     * Gets the href value in an anchor element.
     * Skype transforms raw urls to html. Here we extract the href value from the url
     */
    const parseAnchorTag = input => {
        var match = input.match("^<a href=\"([^\"]*)\">[^<]*</a>$");
        if(match && match[1]) {
            return match[1];
        }

        return null;
    }
//};