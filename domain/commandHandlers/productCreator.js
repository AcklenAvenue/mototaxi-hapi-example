const products = require('../../products');

module.exports = {
    createProduct: (command) => {
        console.log('"productCreator" command handler running');
        let newProduct = {
            name: command.name,
            price: command.price,
        };
        products.add(newProduct);
        newProduct.type = 'productCreated';
        return newProduct;
    }
}