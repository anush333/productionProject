import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  post_title: {
    type: String,
    required: true
  },
  post_body: {
    type: String,
    required: true
  },
  post_comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }]
});

const Post = mongoose.model('Post', postSchema);

export default Post;
