# Allstar-API
Repository for Allstar interview

All requests are expecting JSON bodies when bodies are expected. Any IDs for documents or employee lookup are URL encoded.
Databases used are MongoDB with databases named `documents` and `employees`.

In order to run this, one must go to the the root directory of this repository and type
`npm install`
followed by 
`npm start`
This was tested being run and compiled from Windows Subsystem for Linux.

## Potential Improvements
There were a few point that could have been improved. 
1.  The first aspect that could be improved upon would be security. At the moment, if someone's key is compromised, there is nothing the user can do until it naturally expires at the 24 hours designated have ended.
    This can be solved by the addition of a logout command, which would disable a key, and require a user to create a new key.
2.  Another security issue at the moment is that anyone can edit any document. 
    This could be solved somewhat easily by on updates to a document, the system prevent anyone who didn't create a document, or is an admin from modifying a document.
3.  Recording documents is kind of unintuitive, since the user may not know the exact time they finished their work. 
    The document could alternatively allow the user to provide any 2 of the following 3: start time, end time, and duration.
    With any two pieces of information, this would allow th system to determine the third piece of information.
