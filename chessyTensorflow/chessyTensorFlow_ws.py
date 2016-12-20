#!/usr/bin/python
# -*- coding: utf-8 -*-
import os

from helper_functions_chessbot import *
import chessyTensorflow_core # For neural network model

from flask import Flask, jsonify, request
from werkzeug import secure_filename

app = Flask(__name__)

# This is the path to the upload directory
app.config['UPLOAD_FOLDER'] = 'img/puzzles/'
# These are the extension that we are accepting to be uploaded
app.config['ALLOWED_EXTENSIONS'] = set(['png', 'jpg', 'jpeg', 'gif'])

# For a given file, return whether it's an allowed type or not
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in app.config['ALLOWED_EXTENSIONS']

predictor = chessyTensorflow_core.ChessboardPredictor()

@app.route('/api', methods=['POST'])
def chessyPredict():
    imageUrl = request.args.get('img_url')
    fileName = request.args.get('file_name')
    sideToPlay = request.args.get('side')
    print("\n---\nImage URL: %s - side: %s" % (imageUrl, sideToPlay))

    if imageUrl is None and fileName is None:
        print("> %s - Couldn't generate FEN")
        return jsonify(result=[dict(fen="")])
    else:
        # Start up Tensorflow CNN with trained model
        if imageUrl is not None:
            fen, certainty = predictor.makePrediction(imageUrl)
        else:
            path = os.path.join(app.config['UPLOAD_FOLDER'], fileName)
            fen, certainty = predictor.makePredictionFromFile(path)

        fen = shortenFEN(fen) # ex. '111pq11r' -> '3pq2r'
        print("Predicted FEN: %s" % fen)
        print("Side to Play: %s" % sideToPlay)
        print("Certainty: %.4f%%" % (certainty*100))

        castle_status = getCastlingStatus(fen)
        fen = "%s %s %s -" % (fen, sideToPlay, castle_status)

        # Generate response message
        #msg = generateMessage(fen, certainty, side)
        print("final FEN: %s" % fen)
        return jsonify(result=[dict(fen=fen, certainty=certainty*100)])
        # return jsonify(result=[dict(a=1, b=2), dict(c=3, d=4)])
        #return jsonify(result=[dict(imageUrl=imageUrl)])

@app.route('/upload', methods=['POST'])
def upload():
    # Get the name of the uploaded file
    file = request.files['file']
    # Check if the file is one of the allowed types/extensions
    if file and allowed_file(file.filename):
        # Make the filename safe, remove unsupported chars
        filename = secure_filename(file.filename)
        # Move the file form the temporal folder to
        # the upload folder we setup
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        # Redirect the user to the uploaded_file route, which
        # will basicaly show on the browser the uploaded file
        return jsonify(result=[dict(status="ok")])

if __name__ == '__main__':
    app.run(port = 9001, debug = True)