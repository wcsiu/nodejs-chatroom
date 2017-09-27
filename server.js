#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
var io      = require('socket.io');

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;
    var onlineUsers =[];

    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = '0.0.0.0';
        self.port = 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };

    self.startServer = function() {
        self.server = self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                Date(Date.now() ), self.ipaddress, self.port);
        });
    }

    self.startWebSocket = function() {
        var checkName = function(input) {
            if(onlineUsers.indexOf(input, 0) == "-1") {
                return false;
            }
            else
                return true;
        };
        self.io = io.listen(self.server);
        self.io.on('connection', function(socket){
            console.log('a user connected');
            var time = new Date();

            socket.on('tryName',function(name) {
                name = name.substring(0,8).trim();
                if(name === "") {
                    socket.emit('tryNameResult', false);
                    return false;
                }
                if(!checkName(name) && typeof(socket.username) == "undefined") {
                    var time = new Date();
                    onlineUsers.push(name);
                    socket.username = name;
                    var hours = 0;
                if(time.getHours()+13 > 24)
                    hours = time.getHours()+13 - 24;
                else
                    hours = time.getHours()+13;
                    self.io.emit('chat message',name + ' entered the chatroom (' + hours+":"+time.getMinutes()+")");
                    socket.emit('tryNameResult', true);
                    socket.on('chat message', function(msg, users){
                var time = new Date();
                if(msg !== "") {
                var hours = 0;
                if(time.getHours()+13 > 24)
                    hours = time.getHours()+13 - 24;
                else
                    hours = time.getHours()+13;
                if(users.length > 0) {
                    var connected = self.io.sockets.connected;
                    var whisperResponse = "";
                    for(var i = 0;i < users.length; i++) {
                        for(var id in connected) {
                            if(connected[id].username == users[i] && connected[id].username != socket.username)
                            {
                                connected[id].emit('chat message', socket.username + " whispers to you : " + msg);
                                if(whisperResponse !== "")
                                    whisperResponse += ", ";
                                whisperResponse += connected[id].username;
                            }
                        }
                    }
                    socket.emit('chat message', "You whisper to " + whisperResponse + " : " + msg);
                }
                else
                    self.io.emit('chat message',socket.username + ' : ' + msg + ' (' + hours +':'+time.getMinutes()+')');
            }
          });
            socket.on('disconnect', function(){
                if(typeof(socket.username) !== "undefined") {
                    var time = new Date();
                    var hours = 0;
                if(time.getHours()+13 > 24)
                    hours = time.getHours()+13 - 24;
                else
                    hours = time.getHours()+13;
                var tempIndex = onlineUsers.indexOf(socket.username,0);
                onlineUsers.splice(tempIndex,1);
                self.io.emit('onlineUsers', onlineUsers);
                self.io.emit('chat message',socket.username + ' leaved the chatroom ('+ hours+':'+time.getMinutes()+')');
                
            }
                console.log(socket.username + ' disconnected');
            });

                    self.io.emit('onlineUsers', onlineUsers);
                }
                else {
                    socket.emit('tryNameResult', false);
                }
                            });
        });
    }

    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.startServer();
        self.startWebSocket();
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();

