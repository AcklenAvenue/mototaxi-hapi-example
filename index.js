'use strict';

const awsConfig = require('./aws-config.json');
const dispatcherConfig = {
    logger: {
        log: (message) => {
            //console.log(message);
        }
    },
    sqs: {
        region: awsConfig.region,
        commandQueueUrl: awsConfig.commandQueueUrl,
        eventQueueUrl: awsConfig.eventQueueUrl,
        pollingInterval: 2000,
        maxNumberOfMessages: 5,
    },
    aws: awsConfig
};
const mototaxi = require('mototaxi');
const asyncDispatcher = mototaxi.getDispatcher(dispatcherConfig);

//Two systems in this example: 1) The Microservice and 2) The API

// 1) The microservice watches a specific queue for new commands. When a new command comes in that the
// microservice knows about, it processes the event with the appropriate handler. Then, any events
// created during the execution of the handler are sent to an event queue.
const commandHandlers = [ require('./domain/commandHandlers/productCreator'), require('./domain/commandHandlers/ping-pong') ];
const microservice = require('./microservice');
microservice.start(dispatcherConfig.sqs, commandHandlers);


// 2) The API receives requests and maps them to commands before dispatching them to the command queue.
// Then, we listen for any resulting domain events that come from the event queue, pick the one we want,
// and return it to the API client.
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
            .first()
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
            .first()
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

server.start((err) => {
    if (err) {
        throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
});