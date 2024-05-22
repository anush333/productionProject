from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
from tensorflow.keras.layers import TextVectorization

app = Flask(__name__)

# Load data and prepare TextVectorization
data = pd.read_csv("/Users/anushmali/Toxic Comment Model/train_df.csv")
x = data['Comment']

MAX_WORD = 250000
vectorize_layer = TextVectorization(
    max_tokens=MAX_WORD, 
    output_sequence_length=2000, 
    output_mode='int'
)

vectorize_layer.adapt(x.values)

# Define endpoint for vectorization
@app.route('/vectorize', methods=['POST'])
def vectorize():
    data = request.json
    texts = data['texts']
    vectorized_texts = vectorize_layer(np.array(texts)).numpy().tolist()
    return jsonify(vectorized_texts)

# This function will run at the start of the web application
def on_start():
    print(f"Server is running on http://127.0.0.1:4000")

if __name__ == '__main__':
    on_start()  # Call function to indicate server is running
    app.run(host='127.0.0.1', port=4000)  # Change host to localhost (127.0.0.1)
