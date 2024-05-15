import fs from 'fs';
import * as tf from '@tensorflow/tfjs';

// Load vocabulary and configuration
const vocab = fs.readFileSync('./vocabulary.txt', { encoding: 'utf-8' }).split('\n');
const config = JSON.parse(fs.readFileSync('config.json', { encoding: 'utf-8' }));

// Create a dictionary for token indices with trimmed words
const wordIndex = vocab.reduce((acc, word, idx) => {
    acc[word.trim()] = idx; 
    return acc;
}, {});


if (!('[UNK]' in wordIndex)) {
    console.error("[UNK] token not found in the vocabulary.");
    process.exit(1);
}
const unkIndex = wordIndex['[UNK]'];


console.log("First 10 vocabulary entries:", vocab.slice(0, 10));
console.log("Vocabulary size:", vocab.length);


const sampleWords = ["i", "am", "going", "to", "kill", "you", "and", "rip", "you", "apart"];
sampleWords.forEach(word => {
    console.log(`Index for '${word}':`, wordIndex[word]);
});


function vectorizeText(text, maxLength) {
    const tokens = text.toLowerCase().replace(/[^\w\s]/gi, '').split(' ');
    const vectorized = tokens.map(token => wordIndex[token] !== undefined ? wordIndex[token] : unkIndex);
    const padded = vectorized.length > maxLength ? vectorized.slice(0, maxLength) : vectorized.concat(Array(maxLength - vectorized.length).fill(0));
    return padded;
}


const sampleText = "i am going to kill you and rip you apart";
console.log("Tokenizing text:", sampleText);
const vectorizedText2 = vectorizeText(sampleText, config.output_sequence_length);
console.log("Vectorized Text:", vectorizedText2.slice(0, 30)); // Display first 30 elements



const model_path = process.env.MODEL_PATH;
let model = undefined;

async function loadModel(){
  model = await tf.loadLayersModel(model_path);
  model.summary()

  const input = tf.tensor2d(vectorizedText2, [1, 2000]);
  const result = model.predict(input);

  result.print();

  input.dispose();
  result.dispose();
  model.dispose();
}

loadModel();
