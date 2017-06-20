const products = [];

module.exports = {
    add: (p) => {
        products.push(p);
    },
    getAll: () => products
};