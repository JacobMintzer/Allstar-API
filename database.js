"use strict";
const mongoose=require('mongoose');

/**
 * class to help with database functions
 */
class Database{
	constructor(){
		this.employee=mongoose.createConnection('mongodb://localhost/employees', {
		  useNewUrlParser: true,
		  useUnifiedTopology: true
		});

		this.document= mongoose.createConnection('mongodb://localhost/documents', {
			useNewUrlParser: true,
			useUnifiedTopology: true
		  });

		this.employeeSchema=new mongoose.Schema({
			_id:String,	//_id is email
			pwHash:String,
			role:{ type: String, default: 'Employee' } //can be Employee or Admin
		});

		/**
		 * has start, finish, total time, and notes for easy access
		 * email is used for identification
		 */
		this.documentSchema=new mongoose.Schema({
			startTime:Date,
			finishTime:Date,
			totalTime:Number,
			email:String,
			notes:{ type: String, default: '' }
		});
	}
	/**
	 * Creates a user account. By default you can only create Employees, and not Admins. Email address must be unique
	 * @param {String} email - email address used for your account
	 * @param {String} pwHash - hash of password
	 * @param {String} role - role of account to be created
	 * @returns false if no errors, error if any occur
	 */
	async addEmployee(email, pwHash, role){
		var Employee=this.employee.model(role,this.employeeSchema);
		var result=true;
		try{
			var newEmployee=Employee({_id:email,pwHash:pwHash});
			await newEmployee.save()
		}
		catch(e){
			return e
		}
		return false;
	}
	/**
	 * Looks up a user by email.
	 * @param {String} email - Email address of user to look up
	 * @returns email and role of a found user, else false
	 */
	async getEmployee(email){
		var Employee=this.employee.model('Employee',this.employeeSchema);
		var query=Employee.findOne({_id:email}).exec();
		var result=await query;
		if(result){
			return {email:result._id,
					role:result.role};
		}
		else{
			return false
		}
	}
	/**
	 * Checks to make sure credentials given match up with an existing user
	 * @param {String} email - email supplied by user
	 * @param {String} hash - hash of password supplied by user
	 * @returns false if not found, user object if found
	 */
	async checkCred(email,hash){
		var Employee=this.employee.model('Employee',this.employeeSchema);
		var query=Employee.findOne({_id:email}).exec();
		var result=await query;
		if (result.pwHash!=hash){
			return false
		}
		else{
			return result;
		}
	}
	/**
	 * Given a user's email, looks up and sums all time worked across all documents
	 * @param {String} email - identifier of worker 
	 * @returns {Number} secondsWorked - time worked in seconds across all documents
	 */
	async getEmployeeWork(email){
		var Document = this.document.model('Document',this.documentSchema);
		var query = Document.find({email:email}).exec();
		var result = await query;
		var secondsWorked=0
		for (const doc of result){
			secondsWorked+=doc.totalTime;
		}
		return secondsWorked;

	}

	/**
	 * Gets all employees, and sums all of the seconds worked across different documents to give an overview on each employee
	 * @returns Object with email, role, and time worked in seconds 
	 */
	async getAllEmployees(){
		var Employee=this.employee.model('Employee',this.employeeSchema);
		var query = Employee.find().exec();
		var result=await query;
		var response=[];
		for (var employeeData of result){
			var data={}
			data["email"]=employeeData._id;
			data["role"]=employeeData.role;
			data["timeWorked"]=await this.getEmployeeWork(employeeData._id);
			response.push(data)
		}
		return response;
	}
	/**
	 * Creates a Document that is stored in the database representing time worked by an employee
	 * @param {Object} data - Object holding information provided by user. Always includes e-mail as identifier
	 * @returns {String} Document ID that can be used to retreive, update, or delete this document
	 */
	createDoc(data){
		var Document=this.document.model('Document',this.documentSchema);
		var newDoc=Document({
			startTime:data["startTime"],
			finishTime:data["finishTime"],
			email:data["user"],
			totalTime:data["totalTime"],
			notes:data["notes"]
		});
		newDoc.save();
		return newDoc._id
	}
	/**
	 * Retreives document by ID
	 * @param {String} id - identifier representing a document
	 * @returns object containing information stored in Document
	 */
	async getDoc(id){
		var Document = this.document.model('Document',this.documentSchema);
		var query = Document.findOne({_id:id}).exec();
		var result = await query;
		return result
	}
	/**
	 * Finds all Documents where the search term is found in the notes. Case insensitive.
	 * @param {String} term - Term to search for
	 * @returns list of documents that contain the term specified
	 */
	async searchDoc(term){
		var Document = this.document.model('Document',this.documentSchema);
		var query = Document.find({notes:{"$regex":term,"$options":"i"}}).exec();
		var result = await query;
		return result
	}
	/**
	 * Retreives all documents in the database.
	 * @returns list of documents
	 */
	async getAllDoc(){
		var Document=this.document.model('Document',this.documentSchema);
		var query = Document.find().exec();
		var result=await query;
		return result;
	}
	/**
	 * Finds existing document through document ID. Information in the document is replaced by any provided data
	 * @param {String} id - ID of document to edit
	 * @param {Object} data - Information to replace existing information with
	 * @returns ID of document modified
	 */
	async updateDoc(id,data){
		var curDoc = await this.getDoc(id)
		.catch(()=>{return false});
		if (!curDoc){
			return false;
		}
		if ("finishTime" in data){
			curDoc["finishTime"]=new Date(Date.parse(data["finishTime"].toString()));
		}
		if("totalTime" in data){
			curDoc["totalTime"]=data["totalTime"];
		}
		curDoc["startTime"]=new Date(Date.parse(curDoc["finishTime"])-curDoc["totalTime"]);
		if ("notes" in data){
			curDoc.notes=data.notes;
		}
		curDoc.save();
		
		return curDoc._id
	
	}
	/**
	 * Adds information to a document's note without deleting the existing information.
	 * @param {String} id - ID of document to edit
	 * @param {String} note - Information to concat to existing note in document
	 * @returns ID of document edited
	 */
	async addNote(id,note){
		var curDoc = await this.getDoc(id)
		.catch(()=>{return false});
		if (!curDoc){
			return false;
		}
		curDoc.notes+=(" "+note);
		curDoc.save();
		return curDoc._id
	}
	/**
	 * Deletes document by document ID
	 * @param {String} id - ID of document to delete
	 * @returns Whether or not operation succeeded
	 */
	async deleteDoc(id){
		try{
			var Document=this.document.model('Document',this.documentSchema);
			var query = Document.findOneAndDelete({_id:id}).exec()
			.catch(console.error);
			var result=await query;
			if (result==null){
				return false;
			};
			return true;
		}
		catch (e){
			return false;
		}
	}
	/**
	 * Specifies time period, and retieves all documents that reference time between these two times
	 * @param {Date} start - start time
	 * @param {Date} end - end time
	 * @returns List of Documents that meet the time requirements
	 */
	async getWorkTime(start,end){
		var Document=this.document.model('Document',this.documentSchema);
		var query =  Document.find().and([{startTime:{$lt:end}},{finishTime:{$gt:start}}]).exec()
		var result=await query;
		return result;
	}
}
module.exports={
	Database
}