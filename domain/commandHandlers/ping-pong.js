const products = require('../../products');

module.exports = {
    ping: (command) => {
        return { type: 'pong' };
    }
}