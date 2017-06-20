'use strict';

const sqsConfig = require('./sqs-config.json');

//Two systems in this example: 1) The Microservice and 2) The API

// 1) The microservice watches a specific queue for new commands. When a new command comes in that the
// microservice knows about, it processes the event with the appropriate handler. Then, any events
// created during the execution of the handler are sent to an event queue.

const commandHandlers = [ require('./domain/commandHandlers/productCreator'), require('./domain/commandHandlers/ping-pong') ];
const microservice = require('./microservice');
microservice.start(sqsConfig, commandHandlers);


// 2) The API receives requests and maps them to commands before dispatching them to the command queue.
// Then, we listen for any resulting domain events that come from the event queue, pick the one we want,
// and return it to the API client.

const mototaxi = require('mototaxi');
const asyncConfig = {
    logger: { log: (message) => {  } },
    sqs: sqsConfig,
    aws: require('./aws-config.json'),
};
const asyncDispatcher = mototaxi.getDispatcher(asyncConfig);

const Hapi = require('hapi');
const server = new Hapi.Server();
server.connection({ port: process.env.PORT || 3000 });

server.route({
    method: 'POST',
    path: '/products',
    handler: function (request, reply) {
        const command = {
                type: 'createProduct',
                name: request.payload.name,
                price: request.payload.price
            };

        asyncDispatcher.dispatch(command)
            .filter((domainEvent) => domainEvent.type==='productCreated')
            .subscribe((productCreated) => {
                reply(productCreated);
            });
    }
});

server.route({
    method: 'POST',
    path: '/ping',
    handler: function (request, reply) {
        const command = {
                type: 'ping',
            };

        asyncDispatcher.dispatch(command)
            .filter((domainEvent) => domainEvent.type==='pong')
            .subscribe((productCreated) => {
                reply(productCreated);
            });
    }
});

server.route({
    method: 'GET',
    path: '/products',
    handler: function (request, reply) {
        //fake db of products, also used by the microservice
        const products = require('./products');
        reply(products.getAll());
    }
});

// And, just to demonstrate the difference between async and synchronous dispatchers...
const synchronousConfig = {
    commandHandlers: commandHandlers
};
const synchronousDispatcher = mototaxi.getDispatcher(synchronousConfig);

server.route({
    method: 'POST',
    path: '/ping/sync',
    handler: function (request, reply) {
        const command = {
                type: 'ping',
            };

        synchronousDispatcher.dispatch(command)
            .filter((domainEvent) => domainEvent.type==='pong')
            .subscribe((productCreated) => {
                reply(productCreated);
            });
    }
});


server.start((err) => {
    if (err) {
        throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
});