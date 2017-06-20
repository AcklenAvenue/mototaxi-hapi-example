'use strict';

const products = require('./products');
const mototaxi = require('mototaxi');
const AWS = require('aws-sdk');

const log = (message) => {
    //console.log(message);
};

const removeFromCommandQueue = function(transactionId, sqs, config, message) {
   sqs.deleteMessage({
      QueueUrl: config.commandQueueUrl,
      ReceiptHandle: message.ReceiptHandle
   }, function(err, data) {
      err && console.log(err);
      log(`Consumer: Removed command ${transactionId} from queue.`)
   });
};

const sendDomainEventToQueue = (transactionId, sqs, config, domainEvent) => {
    const eventQueueParams = {
        QueueUrl: config.eventQueueUrl,
        MessageBody: JSON.stringify({
            transactionId: transactionId,
            payload: domainEvent
        })
    };
    sqs.sendMessage(eventQueueParams, (err, sendReceipt) => {
        if(err){
            console.log(err);
            return;
        }
        log(`Consumer: Domain Event ${domainEvent.type} sent to event queue.`)
    } )
}

const pollForMessages = (dispatcher, sqs, config) => {
    const commandQueueParams = {
        QueueUrl: config.commandQueueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 5
    };
    sqs.receiveMessage(commandQueueParams, (err, data) => {
        if(err){
            console.log(err);
            return;
        }

        (data.Messages || []).forEach((message) => {
            const transaction  = JSON.parse(message.Body);
            log(`Consumer: Received command ${transaction.type} from queue. Dispatching to handler.`);
            dispatcher.dispatch(transaction.payload)
                .subscribe((e) => {
                    log(`Consumer: Domain event ${e.type} returned from command handler.`);
                    removeFromCommandQueue(transaction.transactionId, sqs, config, message);
                    sendDomainEventToQueue(transaction.transactionId, sqs, config, e);
                });
        });
  });
}

module.exports.start = (config, commandHandlers) => {
    const sqs = new AWS.SQS({region: config.region});
    const dispatcher = mototaxi.getDispatcher({
        commandHandlers: commandHandlers
    });

    const pollInterval = 5000;
    setInterval(() => {
        pollForMessages(dispatcher, sqs, config)
    }, pollInterval);

    pollForMessages(dispatcher, sqs, config);
};
