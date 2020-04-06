var tinydb = require('tinydb');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var server = require('http').Server(app);
var io = require('socket.io')(server);

var app = express();

// view engine setup
var app = express()
  , server = require('http').createServer(app)
  , io = io.listen(server);

server.listen(80);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});


// Socket
TinyDB = new tinydb('./test.db');


async function get_user_list(){
    var arr;
    await TinyDB.getInfo("0", function(err, key, value){
	if (err) {
	    console.log(err);
	    return 1;
	}
	if(value.length == 1)
	    value = [value]
	value[0] = parseInt(value[0])
	arr = value
	if(arr.length != arr[0] + 1)
	    console.log("list corrupted, please purge database at some point")
	console.log(value)
    })
    return arr
}

async function set_user_list(val){ 
    var ret = 0;
    await TinyDB.setInfo('0', val, function(err, key, value){ // Return Error if Error
		if(err){
		    console.log(err)
		    ret = 1
		}
		console.log('[Userlist set] ' + key + ' : ' + value);
     })
    return ret;
}

async function add_user(user){ 
    var info;
    var ret;
    await TinyDB.getInfo(user, function(err, key, value) { // Check if user has been created already
        if (err && err.message != "key not exist.") {
	    console.log(err);
	    ret = 1;
	}
	info = value;
    });
    if(ret)
	return ret;
    if(info != "" && info)
	return 1; // Duplicate
    
    if(user.valueOf() == "0"){ // Initalize user list if requested (as noted by key "") -- first number is number of users in list
	await TinyDB.setInfo(user, '0', function(err, key, value){ // Return Error if Error
	    if(err){
		console.log(err)
		ret = 1
	    }
	    else{
	    console.log('[Userlist Initialized] ' + key + ' : ' + value);
	    ret = ('[Userlist Initialized] ' + key + ' : ' + value);
	    }
	});
	return ret;
    }
    else{
	await TinyDB.setInfo(user, '{}', function(err, key, value) { // Set user to empty map
	    if (err) {
		console.log(err);
		ret = 1;
	    }
	    info = value;
	});
	if(ret)
	    return ret;
	
	var arr = await get_user_list() // Add user to userlist
	if(!arr)
	    return 1;
	arr[0] += 1
	arr.push(user)
	var val = await set_user_list(arr)
	if(val == 1)
	    return 1;
	console.log('[User Added] ' + user + ' : ' + info);
	return('[User Added] ' + user + ' : ' + info);
    }
}

async function remove_user( user){ 
    var ret;
    await TinyDB.getInfo(user, async function(err, key, value) { // Check that user exists
            if (err) { // Also check for when user does not exist
		console.log(err);
		ret = 1;
            }
    })
    if(ret)
	return ret
    // Remove from list
    var arr = await get_user_list()
    if(!arr)
	return 1;
    arr[0] -= 1
    arr.splice(arr.indexOf(user), 1)
    var val = await set_user_list(arr)
    if(val == 1)
	return 1;

    ret = 0
    await TinyDB.setInfo(user, '', function(err, key, value) { // Set user to empty                  
	if (err) {
	    console.log(err);
	    ret = 1;
	}
	console.log('[User removed] ' + user + ' : ' + val);
    });

    return ret;
}

async function message_user(sender, receiver, message){
    var ret;
    var info;
    await TinyDB.getInfo(receiver, function(err, key, value) {
        if (err && err.message != "key not exist.") {
            console.log(err);
            ret = err;
        }
	if(value == "" || !value){ // Possibly check whether receiver exists
	    ret = "Receiver not found"
	}
	info = value
    })
    if(ret)
	return ret
    var map = new Map(JSON.parse(info))
    map.set(sender, message)
    var str = JSON.stringify(Array.from( map.entries()));
    ret = 0
    await TinyDB.setInfo(receiver, str, function(err, key, value) { // Set user to map                                                                                                 
	if (err) {            
		console.log(err);
                ret = err;
            }
            console.log('[Message sent] ' + key + ' : ' + value);
        });
    return ret;
}
    
async function user_messages(user){
    var value;
    await TinyDB.getInfo(user, value =>function(err, key, value) {
	if (err && err.message != "key not exist.") {
	    console.log(err);
	    return "";
	}
	if(value == "")
	    return "Could not find user: " + user;
	console.log('[User messages] ' + key + ' : ' + value);
	return value;
    });
    return value
}

TinyDB.onReady = async function() {
    console.log('database is ready for operating');    
    var x = await add_user("0"); // add list of users
    io.on('connection', async function (socket) {
	var user = "";

	socket.on('user connected', async function(data) { // expects "user connected", data: user
	    if(data.user != "" && data.user){
		if(user != "")
		    await remove_user(user)
		var result = await add_user(data.user)
		if(result == 1){
//		    socket.emit(user, {err: "Username not allowed"}) // will return username not allowed if it is a duplicate or other reasons
		    console.log("failed to add user")
		}
		else{
		    user = data.user
		    socket.emit(user, {success: "User Added"})
		    var users = await get_user_list()
		    io.emit('users', {users: users});
		}
	    }
	});
	socket.on('disconnect', async function () {
            if(user != ""){
		if(await remove_user(user) != 0)
		    console.log("could not find user: " + user)
//		socket.emit(user, {err: "Username not found"}) // will return username not allowed if it is not found for some reason
		var users = await get_user_list()
		io.emit('users', {users: users})
		
	    }
	});
	socket.on('send message', async function(data) { // expects "send message" data: map[("message", message), ("recipient", recipient)]
            var map	= new Map(JSON.parse(data))
	    var message = map.get("message", "")
	    var recipient = map.get("recipient", "")
	    if(user != "" && message != "" && recipient != ""){
		var err = await message_user(user, recipient, message);   // will emit to client in method if issues are faced
		if(err != 0)
		    socket.emit(user, {err: "Could not send message"})
		else
		    io.emit(recipient, {sender: user, message: message})
	    }
	});
	
    });
}
