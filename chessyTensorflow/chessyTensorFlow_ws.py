#!/usr/bin/python
# -*- coding: utf-8 -*-

from helper_functions_chessbot import *
import chessyTensorflow_core # For neural network model

from flask import Flask, jsonify, request

app = Flask(__name__)

predictor = chessyTensorflow_core.ChessboardPredictor()

@app.route('/api', methods=['POST'])
def chessyPredict():
    imageUrl = request.args.get('img_url')
    sideToPlay = request.args.get('side')
    print("\n---\nImage URL: %s - side: %s" % (imageUrl, sideToPlay))

    if imageUrl is None:
        print("> %s - Couldn't generate FEN")
        return jsonify(result=[dict(fen="")])
    else:
        # Start up Tensorflow CNN with trained model

        fen, certainty = predictor.makePrediction(imageUrl)
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

if __name__ == '__main__':
    app.run(port = 9001, debug = True)