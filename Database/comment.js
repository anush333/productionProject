import mongoose from "mongoose";
// import { userSchema } from "./user.js";
const commentSchema = new mongoose.Schema({
    comment_body: {
        type: String,
        required: true
    },
    comment_user: {
        type: String,
    },
    post_id: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    }
});


const Comment = mongoose.model("Comment", commentSchema);

export default Comment;