const { Errors } = require('moleculer');
const {pbkdf2} = require("crypto");
const jwt = require("jsonwebtoken");
const ESService = require("moleculer-elasticsearch");

module.exports = {
  name: 'pricing',
  mixins: [ESService],
  settings: {
    elasticsearch: {
      host: process.env.ELASTICSEARCH_HOST || "http://localhost:9200",
      apiVersion: "6.8"
    }
  },
  actions: {
    calculate: {
      params: {
        userId: 'string'
      },
      async handler(ctx) {
        const { userId } = ctx.params;
        let cart = await ctx.call('cart.getCart', {userId});
        if (cart) {
          let amount = 0
          let quantityPrice = 0
          if (cart._source.item.length !== 0) {
            for (const item of cart._source.item) {
              let productPrice = await this.findItem(item.productId)
              quantityPrice = productPrice * item.quantity
              amount = amount + quantityPrice
              console.log("calculate" , amount)
            }
            console.log("return" , amount)
            return amount
          }
        }
        return 100;
      },
    },
  },
  methods : {
    async findItem(productId) {
      return new Promise(async (resolve, reject) => {
        console.log(productId)
        let product =  await this.client.search({
          index : 'product',
          type: 'doc',
          body: {
            query: {
              match_phrase: {Name : productId}
            }
          }
        })
        console.log(product , "ppppp")
          resolve(product.hits.hits[0]._source.price)
      })
    },
  }
};
