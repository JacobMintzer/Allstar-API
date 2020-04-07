const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const Database=require('./database');


app.use(bodyParser.json());
const accessTokenSecret='j9D9s93aMNUt2d8PKWTGbbYJ';
const db=new Database.Database();

/**
 * Checks to see that token is valid for this endpoint. User information is passed into the request object.
 */
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        var x=jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
			}
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
	}
};
/**
 * Checks to see if token is valid for this endpoint, as well as that user has admin role. User information is passed into the request object.
 */
const authenticateAdminJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
			}
			if(user.role!="Admin"){
				return res.sendStatus(401)
			}
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
	}
};
/**
 * Specifies time period, and retieves all documents that reference time between these two times
 * @param {Date} body.startTime - start time
 * @param {Date} body.endTime - end time
 * @requires admin 
 * @returns List of Documents that meet the time requirements
 */
app.get('/get-times',authenticateAdminJWT,(req,res)=>{
	try{
		var start=new Date(Date.parse(req.body.startTime));
		var end=new Date(Date.parse(req.body.finishTime));
	}
	catch(e){
		res.status(422).send("Invalid dates. Please provide in the format `2020-04-05T12:01:00.000Z`.")
	}
	if (end<=start){
		res.status(422).send("Start time cannot be the same as or after end time. ")
	}
	db.getWorkTime(start,end).then(result=>{
		res.json(result);
	})

})

/**
 * Retreives all documents in the database.
 * @returns list of documents
 */
app.get('/document',authenticateJWT,(req,res)=>{
	db.getAllDoc().then(result=>{
		if(result){
			res.send(result); 
		}
		else{
			res.sendStatus(404);
		}
	})
})

/**
 * Creates a Document that is stored in the database representing time worked by an employee. Start time is calculated from totalTime and finishTime
 * @param {Date} body.finishTime - time work is finished
 * @param {Number} body.totalTime - time in seconds worked
 * @param {String} body.notes - notes to add to document
 * @returns 201 response on success with document ID that can be used to retreive, update, or delete this document
 */
app.post('/document',authenticateJWT,(req,res)=>{
	var newDoc={user:req.user.username};
	if ("finishTime" in req.body){
		newDoc["finishTime"]=Date.parse(req.body.finishTime);
		
		//if both finish time and total time are included, we can calculate start time
		if ("totalTime" in req.body){
			newDoc["totalTime"]=req.body.totalTime;
			newDoc["startTime"]=new Date(newDoc["finishTime"]-1000*newDoc["totalTime"]);
		}
	}
	else if ("totalTime" in req.body){
		newDoc["totalTime"]=req.body.totalTime;
	}
	if ("notes" in req.body){
		newDoc["notes"]=req.body.notes;
	}
	res.status(201).send(db.createDoc(newDoc))
	
})

/**
 * Finds existing document through document ID. Information in the document is replaced by any provided data
 * @param {String} id - Id of document to modify
 * @param {Date} body.finishTime - time work is finished
 * @param {Number} body.totalTime - time in seconds worked
 * @param {String} body.notes - notes to add to document
 */
app.post('/document/:id',authenticateJWT,(req,res)=>{
	var id=req.params.id;
	var data=req.body
	db.updateDoc(id,data)
	.then(result=>{
		if(result){
			res.status(201).send(result);
		}
		else{
			res.sendStatus(404);
		}
	},e=>{console.error(e)});
})

/**
 * Adds information to a document's note without deleting the existing information.
 * @param {String} id - ID of document to edit
 * @param {String} body.note - Information to concat to existing note in document
 * @returns ID of document edited
 */
app.post('/add-note/:id',authenticateJWT,(req,res)=>{
	var id=req.params.id;
	var data=req.body
	db.addNote(id,data.note)
	.then(result=>{
		if(result){
			res.status(201).send(result);
		}
		else{
			res.sendStatus(404);
		}
	},e=>{console.error(e)});
})

/**
 * Deletes document by document ID
 * @param {String} id - ID of document to delete
 * @returns Whether or not operation succeeded
 */
app.delete('/document/:id',authenticateJWT,(req,res)=>{
	var id=req.params.id;
	db.deleteDoc(id).then(result=>{
		if(result){
			res.sendStatus(200);
		}
		else{
			res.sendStatus(404);
		}
	})
})

/**
 * Retreives document by ID
 * @param {String} id - identifier representing a document
 * @returns object containing information stored in Document
 */
app.get('/document/:id',authenticateJWT,(req,res)=>{
	var id=req.params.id;
	db.getDoc(id).then(result=>{
		if(result){
			res.send(result);
		}
		else{
			res.sendStatus(404);
		}
	})
	.catch(e=>{
		res.sendStatus(404)
	})
});

/**
 * Finds all Documents where the search term is found in the notes. Case insensitive.
 * @param {String} body.term - Term to search for
 * @requires admin 
 * @returns list of documents that contain the term specified
 */
app.get('/search',authenticateAdminJWT,(req,res)=>{
	var term=req.body.term;
	db.searchDoc(term).then(result=>{
		if(result){
			res.status(200).json(result);
		}
		else{
			res.endStatus(404)
		}
	}).catch(e=>{
		res.sendStatus(e)
	})
})

/**
 * Looks up a user by email.
 * @param {String} email - Email address of user to look up
 * @returns email and role of a found user, else false
 */
app.get('/employee/:id',(req,res)=>{
	var id=req.params.id;
	db.getEmployee(id).then(employee=>{
		if(employee){
			res.json(employee)
		}
		else{
			res.sendStatus(404);
		}
	})
	.catch(e=>{
		res.send(e)
	});
})

/**
 * Gets all employees, and sums all of the seconds worked across different documents to give an overview on each employee
 * @requires admin 
 * @returns Object with email, role, and time worked in seconds 
 */
app.get('/employee',authenticateAdminJWT,(req,res)=>{
	db.getAllEmployees().then(result=>{
		if(result){
			res.send(result);
		}
		else{
			res.endStatus(404)
		}
	})
	.catch(e=>{
		res.sendStatus(404)
	});
})


/**
 * Checks to make sure credentials given match up with an existing user
 * @param {String} email - email supplied by user
 * @param {String} passowrd - password supplied by user. Only hash is kept
 * @returns access token if successful, 403 error if not
 */
app.post('/login', (req, res) => {
	// Read username and password from request body
	const { email, password } = req.body;
	var pwHash = crypto.createHash('sha256').update(password).digest('hex');
    // Filter user from the users array by username and password
    db.checkCred(email,pwHash)
		.then(user=>{
		    if (user) {
				// Generate an access token
				const accessToken = jwt.sign({ username: user._id,  role: user.role }, accessTokenSecret,{expiresIn: '24h'});
		        res.json({
					accessToken
		        });
			} 
			else {
		        res.status(403).send('Authentication Failed');
			}
		})
});

/**
 * Creates a user account. By default you can only create Employees, and not Admins. Email address must be unique
 * @param {String} email - email address used for your account
 * @param {String} password - Password for account. Must be more than 5 characters in length
 * @returns 200 response if no errors, otherwise 400 response and error message
 */
app.post('/signup',(req,res)=>{
	//regex for email, should catch most incorrect/malformed email addresses
	var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	const{email,password}=req.body;
	if (!re.test(String(email).toLowerCase())){
		res.status(422).send("Invalid e-mail address");
	}
	//basic length requirement for password
	if (password.length<5){
		res.status(422).send("Password must be greater than 5 characters long");
	}
	//password isn't stored, only the hash is in case of data breach
	var pwHash = crypto.createHash('sha256').update(password).digest('hex');
	db.addEmployee(email,pwHash,'Employee').then(result=>{
		if (!result){
			res.sendStatus(200);
		}
		else{
			res.status(400).send(result.errmsg)
		}
	})
})

app.listen(3000, () => {
    console.log('Engineering evaluation API started at localhost:3000/');
});

