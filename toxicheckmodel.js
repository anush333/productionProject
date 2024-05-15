import axios from 'axios';
import * as tf from '@tensorflow/tfjs';
import fetchComments from './fetchcomment.js';
import "dotenv/config";

async function getVectorizedTexts(texts) {
    try {
        const response = await axios.post('http://localhost:4000/vectorize', { texts });
        return response.data;
    } catch (error) {
        console.error('Error vectorizing texts:', error);
        throw error;
    }
}

const model_path = process.env.MODEL_PATH;
let model = undefined;

async function loadModel() {
    try {
        model = await tf.loadLayersModel(model_path);
        console.log('Model loaded successfully');
        model.summary(); 
    } catch (error) {
        console.error('Error loading model:', error);
    }
}

async function makePrediction(texts) {
    try {
        if (!model) await loadModel(); 

        const vectorizedTexts = await getVectorizedTexts(texts);
        const input = tf.tensor2d(vectorizedTexts, [vectorizedTexts.length, 2000]); 
        const result = model.predict(input);

        return result.arraySync(); 
    } catch (error) {
        console.error('Error during vectorization or prediction:', error);
    }
}

// make predictions, and return results
async function processComments() {
    const comments = await fetchComments(); 
    const commentTexts = comments.map(comment => comment.comment_body); 
    const predictions = await makePrediction(commentTexts); 

    
    const results = comments.map((comment, index) => ({
        comment_body: comment.comment_body,
        post_id: comment.post_id,
        comment_user: comment.comment_user,
        prediction: predictions[index]
    }));

    return results;
}



processComments().then(results => {
    console.log('comment processed');
}).catch(error => {
    console.error('Failed to process comments:', error);
});


export default processComments;