import mongoose from "mongoose";
import "dotenv/config";
import Comment from "./Database/comment.js";


async function fetchComments(query = {}, options = {}) {
    try {
      const comments = await Comment.find(query)
        .select('comment_body post_id comment_user _id') 
        .sort(options.sort || '-_id')
        .limit(options.limit || 50)
        .skip(options.skip || 0)
        .exec();
        return comments;
    } catch (error) {
        console.error('Error fetching comments:', error);
        throw error;
    }
}




// fetchComments().then(comments => console.log("comments fetched"))
//               .catch(error => console.error('Failed to fetch comments:', error));

              
export default fetchComments;
