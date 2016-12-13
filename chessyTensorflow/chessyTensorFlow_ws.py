#!/usr/bin/python
# -*- coding: utf-8 -*-

from helper_functions_chessbot import *
import chessyTensorflow_core # For neural network model

from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/api', methods=['GET'])
def chessyPredict():
    imageUrl = request.args.get('img_url')
    print("\n---\nImage URL: %s" % imageUrl)

    if imageUrl is None:
        print("> %s - Couldn't generate FEN")
        return jsonify(result=[dict(fen="")])
    else:
        # Start up Tensorflow CNN with trained model
        predictor = chessyTensorflow_core.ChessboardPredictor()
        fen, certainty = predictor.makePrediction(imageUrl)
        fen = shortenFEN(fen) # ex. '111pq11r' -> '3pq2r'
        print("Predicted FEN: %s" % fen)
        print("Certainty: %.4f%%" % (certainty*100))

        # Get side from title or fen
        side = getSideToPlay("", fen)
        # Generate response message
        #msg = generateMessage(fen, certainty, side)
        print("fen: %s\nside: %s\n" % (fen, side))
        return jsonify(result=[dict(fen=fen, certainty=certainty*100, side=side)])
        # return jsonify(result=[dict(a=1, b=2), dict(c=3, d=4)])
        #return jsonify(result=[dict(imageUrl=imageUrl)])

if __name__ == '__main__':
    app.run(port = 9001, debug = True)