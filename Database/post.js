import mongoose from "mongoose";

const postSchema = {
    post_title: {
        type: String,
    },
    post_body: {
        type: String,
    },
    post_comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    }]
};

const Post = mongoose.model("Post", postSchema);

export default Post;