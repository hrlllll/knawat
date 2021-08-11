const  ESService  = require('moleculer-elasticsearch');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    name: 'product',
    mixins: [ESService],
    settings: {
        elasticsearch: {
            host: process.env.ELASTICSEARCH_HOST || "http://localhost:9200",
            apiVersion: "6.8"
        }
    },
    actions: {
        add: {
            params: {
                productName: 'string',
                price: 'number'
            },
            async handler(ctx) {
                let { productName, price } = ctx.params;
                try {
                    let product = await this.addProduct(productName, price);
                    if (product) {
                        return {product : product};
                    }
                    else {
                        ctx.meta.$statusCode = 400;
                        return {error : "body is undefined"};
                    }
                }catch (e) {
                    ctx.meta.$statusCode = e.status;
                    return {error : e.error , code: e.code};

                }
                }
            },
        get_all: {
            async handler() {
                try {
                    let product = await this.getAllProduct();
                    if (product) {
                        return {product : product};
                    }
                    else {
                        return {product : null};
                    }
                }catch (e) {
                    console.log(e)
                    return e;
                }
                }
            }
        },
    methods : {
        async addProduct(productName, price) {
            return new Promise(async (resolve, reject) => {
                try {
                    let product = await this.client.create({
                        index : 'product',
                        id : productName,
                        type : "doc",
                        body: {
                            Name: productName ,
                            price: price
                        }
                    })
                    resolve(product)
                } catch (e) {
                    if (e.status === 409) reject({error: "duplicate product", status : 400 , code : 409})
                }
            })


        },
        async getAllProduct() {
            let products = await this.client.search({
                index : 'product',
                type : "doc",
            })
            return products.hits.hits
        },
    }
};
