import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";
import { User } from "./Database/user.js";
import Post from "./Database/post.js";
import Comment from "./Database/comment.js";
import validator from "email-validator";
import bcrypt from "bcrypt";
import sendMail from "./mailer.js";
import jwt from "jsonwebtoken";
import cookieParser  from 'cookie-parser';
import session from 'express-session';
import MongoStore from "connect-mongo";
import processComments from './toxicheckmodel.js'; 


import * as tf from '@tensorflow/tfjs';
import fs from 'fs';

const app = express();
app.use(cors());
mongoose.connect(process.env.URL).then(console.log("Connected!"));



app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'session',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.URL
  }),
  //cookie: { maxAge: new Date ( Date.now() + (3600000) ) } 
}));

app.use(express.static("public"));
app.use(express.static("images"));

const authMiddleware = (req, res, next ) => {
  const token = req.cookies.token;

  if(!token) {
    return res.status(401).json( { message: 'Unauthorized'} );
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.userId = decoded.userId;
    next();
  } catch(error) {
    res.status(401).json( { message: 'Unauthorized'} );
  }
}

app.get("/", authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({});
    const role = req.session.user.role
    res.render("home", { posts: posts, role: role });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


//user registration
app.get("/signup", async(req, res) => {
  res.render("register");
});

app.post("/signup", async(req, res) => {
  const {user_name, user_email, user_password} = req.body;
  try{
    if ( user_name === "" || user_email === "" || user_password === "")
      return res.status(400).json({message: "Enter value for all fields."});
    if(!validator.validate(user_email))
      return res.json({message: "Invalid Email."});
    const encryptedPassword = await bcrypt.hash(user_password, 10);
    const user = await User.create({
      ...req.body,
      user_password: encryptedPassword,
      user_role : "admin",
    });
    res.redirect("/login");
    console.log(user);
  } catch (error){
    res.json({message: error});
  }
});



//user login
app.get("/login", async(req, res) => {
  res.render("login");
});

app.post("/login", async(req, res) => {
    const user_email = req.body.user_email
    const user_password = req.body.user_password
    const validUser = await User.findOne({ user_email: user_email });
  if (!validUser) {
    return res.status(400).json({ message: "User not found." });
  }
  if (!(await bcrypt.compare(user_password, validUser.user_password))) {
    res.json({ message: "Please enter a valid password." });
  }

  // const accessToken = jwt.sign(
  //   { user_email: user_email },
  //   process.env.ACCESS_TOKEN_SECRET,
  //   { expiresIn: "10m" }
  // );
  const token = jwt.sign({ userId: validUser._id}, process.env.ACCESS_TOKEN_SECRET);
  req.session.user = { id: validUser._id, name: validUser.user_name ,role: validUser.user_role}; // Store user info in session
  res.cookie('token', token, { httpOnly: true });
  // res.cookie('token', accessToken, { httpOnly: true });
  // res.json({ accessToken: accessToken });
  res.redirect("/");
});

function generateRandomNumber() {
  return Math.floor(Math.random() * 900000) + 100000;
}

app.get("/forget-password", async (req, res) => {
  res.render("forgetpassword");
});

//forget password
app.post("/forget-password", async (req, res) => {
  const randomNumber = generateRandomNumber();
  const user_email = req.body.user_email
  if(!validator.validate(user_email))
    return res.json({message: "Invalid Email."});
  // const emailFound =  await User.findOne({user_email: user_email});
  // if (!emailFound)
  //   return res.status(404).json({message: "Email not found"});
  sendMail(randomNumber, user_email);
  req.session.code = { code: randomNumber };
  req.session.user_email = {email: user_email};
  res.redirect("/verify-code")
});

app.get("/verify-code", async (re, res) => {
  res.render("verifycode");
});

app.post("/verify-code", async (req, res) => {
  const validCode = JSON.stringify(req.session.code.code);
  console.log("valid code", {validCode});
  const providedCode = req.body.verificationcode;
  console.log("provide code", {providedCode});
  if (validCode !== providedCode)
    return res.json({message: "Invalid Code."});
  res.redirect("/change-password")  
});

app.get("/change-password", async (re, res) => {
  res.render("changepassword");
});

// change password
app.post("/change-password", async (req, res) => {
  const password = req.body.new_password;
  const confirm_password = req.body.confirm_password;
  const user_email = req.session.user_email.email;
  console.log("new pass",{password});
  console.log("Confirm", {confirm_password});
  console.log(user_email);
  if (password !== confirm_password)
    return res.json("Invalid");

  // res.json("done");
  const encryptedPassword = await bcrypt.hash(confirm_password, 10);

  await User.updateOne(
		{ user_email: user_email },
		{
			user_password: encryptedPassword,
		}
	);

  res.redirect("/login")  
});

// logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  //res.json({ message: 'Logout successful.'});
  res.redirect('/login');
});

app.get("/newposts", async (req, res) => {
  res.render("addpost");
});

app.get("/newposts", async (req, res) => {
  res.render("addpost");
});

//create post
app.post("/newposts", async (req, res) => {
    const post = await Post.create({
        post_title: req.body.post_title,
        post_body: req.body.post_body,
    });
    console.log(post);
    res.redirect("/");
});

// select specific post
// app.get("/posts/:postId", async(req, res) => {
//     // const requestedPostId = req.params.postId;
//     //  const getPost = await Post.findOne({_id: requestedPostId}).exec();
//     // res.json(getPost);
//       try {
//         const requestedPostId = req.params.postId;
//         // const post = await Post.findOne({_id: requestedPostId}).exec();
//         const post = await Post.findOne({_id: requestedPostId}).populate('post_comments').exec();

    
//         if (!post) {
//           return res.status(404).send("Post not found");
//         }
//         res.render("post", {
//           // post_title: post.post_title,
//           // post_body: post.post_body
//            post: post 
//         });
//       } catch (err) {
//         console.error(err);
//         res.status(500).send("Internal Server Error");
//       }
//   });

// app.get("/posts/:postId", async (req, res) => {
//   try {
//     const requestedPostId = req.params.postId;

//     // Fetch the post along with its comments populated
//     const post = await Post.findOne({_id: requestedPostId}).populate('post_comments').exec();
//     if (!post) {
//       return res.status(404).send("Post not found");
//     }

//     // Process comments through the prediction model, assuming processComments is set up to update comments directly
//     const processedComments = await processComments(post.post_comments.map(comment => comment.comment_body));
//     console.log("Processed Comments with Predictions:", processedComments); // Log processed comments with predictions


//   // Append predictions to each comment correctly
//   post.post_comments.forEach((comment, index) => {
//   comment.prediction = processedComments[index].prediction;  // Ensure predictions are attached properly
// });

// console.log("Updated Comments with Predictions:", post.post_comments);  // Log to confirm predictions are attached


//     // Render the post with updated comments
//     res.render("post", { post: post });
//   } catch (err) {
//     console.error("Error fetching the post: ", err);
//     res.status(500).send("Internal Server Error");
//   }
// });


function getCommentClass(predictions) {
  const classes = [];
  if (predictions[0] > 0.5) classes.push('toxic');
  if (predictions[1] > 0.5) classes.push('severe-toxic');
  if (predictions[2] > 0.5) classes.push('threat');
  if (predictions[3] > 0.5) classes.push('insult');
  if (predictions[4] > 0.5) classes.push('identity_hate');
  return classes.join(' '); // Combine classes for multiple matching labels
}

function formatPredictions(predictions) {
  return predictions.map(pred => pred.toFixed(2)).join(', '); // Format for display
}

// new get post
app.get('/posts/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const role = req.session.user.role
    // const post = await Post.findById(postId).lean(); // Fetch the post
    const post = await Post.findById(postId).populate({
      path: 'post_comments',
      select: 'comment_body comment_user _id' 
    }).lean();

    if (!post) {
      res.status(404).send('Post not found');
      return;
    }

    console.log("Fetched comments: ", JSON.stringify(post.post_comments, null, 2));
    // console.log("this is ", {post});
    // const commentsWithPredictions = await processComments(); 
    // const filteredComments = commentsWithPredictions.filter(c => c.post_id.toString() === postId); 

    const commentsWithPredictions = await processComments(post.post_comments);
    const filteredComments = commentsWithPredictions.filter(c => c.post_id && c.post_id.toString() === postId);


    post.post_comments = filteredComments; // Attach comments to post
    console.log("Filtered comments: ", JSON.stringify(post.post_comments, null, 2));
    // console.log(post.post_comment)
    res.render('post', {
      post,
      role,
      getCommentClass, 
      formatPredictions 
    }); 

  } catch (error) {
    console.error('Error fetching post and comments:', error);
    res.status(500).send('Error fetching data');
  }
});






//edit post
app.get("/posts/:postId/edit", async(req, res) => {
    try {
        const requestedPostId = req.params.postId;
        const post = await Post.findOne({_id: requestedPostId}).exec();

        if (!post) {
            return res.status(404).send("Post not found");
        }      
        res.render("edit", { post });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
})

// // edit post
// app.patch("/posts/:id", async (req, res) => {
//   const id = req.params.id;
//   const update = req.body;
//   try {
//     const updatedPost = await Post.findByIdAndUpdate(id, update, { new: true });
//     res.json(updatedPost);
//     console.log(updatedPost.post_title);
//     res.redirect("/")
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
  
// });

app.post("/posts/:id", async (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;

  try {
    // Find the post by ID and update its title and content
    await Post.findByIdAndUpdate(
      postId,
      { post_title: title, post_body: content },
      { new: true }
    );

    
    res.redirect("/");
  } catch (error) {
    
    console.error("Error updating post:", error);
    res.status(500).send("Internal Server Error");
  }
});


//delete post
app.post('/delete/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send('Post not found');
    }
    await Comment.deleteMany({ post_id: post._id });

    await Post.findByIdAndDelete(post._id);

    res.redirect('/');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).send('Internal Server Error');
  }
});

// app.delete('/post/:postId', async (req, res) => {
//   const postId = req.params.postId;

//   try {
//       await Post.findByIdAndRemove(postId);
//       await Comment.deleteMany({ post_id: postId });  // Remove all comments associated with the post

//       res.send('Post and related comments deleted successfully');
//   } catch (error) {
//       console.error('Error deleting post and comments:', error);
//       res.status(500).send('Internal Server Error');
//   }
// });


//add comment
// app.post("/posts/:id/comments", async (req, res) => {
//   const post = await Comment.create({
//       comment_body: req.body.comment_body,
//       comment_user: req.body.comment_user,
//   });
//   await Post.findById(req.params.id).exec()
//   res.json(post);
// });

// app.post("/post/:id/comments", async (req, res) => {
//   try {
//     // Create a new comment
//     const comment = await Comment.create({
//       comment_body: req.body.comment_body,
//     });

//     // Find the post by id
//     const post = await Post.findById(req.params.id);

//     // Push the created comment to the post's comments array
//     post.post_comments.push(comment);

//     // Save the updated post
//     await post.save();

//     // Send the updated post as a respon
//     res.redirect("/")
    
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'An error occurred' });
//   }
// });

app.post('/post/:postId/comments', async (req, res) => {
  const { comment_body} = req.body;
  const postId = req.params.postId;

  const a = req.body
  console.log('consoled', {a});
  try {
    // Create a new comment
    const comment = await Comment.create({ comment_body, post_id: postId, comment_user: req.session.user.name});

    
    const post = await Post.findById(postId);

    
    post.post_comments.push(comment._id);  

    // Save the updated post
    await post.save();

    // res.redirect(`/post/${postId}`);

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).send('Internal Server Error');
  }
});



// app.post("/post/:id/comments", async (req, res) => {
//   try {
//     // Create a new comment
//     const comment = await Comment.create({
//       comment_body: req.body.comment_body,
//     });

//     // Find the post by id
//     const post = await Post.findById(req.params.id);

//     // Push the created comment to the post's comments array
//     post.post_comments.push(comment);

//     // Save the updated post
//     await post.save();

//     // Send the updated post as a respon
//     res.redirect("/")
    
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'An error occurred' });
//   }
// });


// app.post("/posts/:id/comments", async (req, res) => {
//   const comment = new Comment({
//     comment_body: req.body.comment_body,
//     comment_user: "a",
//   });
//   comment.save((err, result)=>{
//     if (err){
//       console.log(err)
//     }else{
//       Post.findById(req.params.id, (err,post) => {
//         if(err){
//           console.log(err);
//         } else{
//           post.post_comments.push(result);
//           post.save();
//           res.json(post);
//         }
//       })
//     }
//   })
// });

//delete comment
app.post('/posts/:postId/delete-comment', async (req, res) => {
  const { postId } = req.params;
  const { commentId } = req.body; // Retrieve the commentId from the form submission

  console.log("comment id is",{commentId});
  try {
    // Delete the comment
    await Comment.findByIdAndDelete(commentId);
    
    //remove from post array
    const post = await Post.findById(postId);
    post.post_comments.pull(commentId);
    await post.save();
    
    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).send('Internal Server Error');
  }
});

//edit comment


app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
});
