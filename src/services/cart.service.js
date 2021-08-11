const ESService = require("moleculer-elasticsearch");
const { Errors } = require('moleculer');
const { v4: uuidv4 } = require('uuid');
const {started} = require("moleculer-web");

module.exports = {
    name: 'cart',
    mixins: [ESService],
    settings: {
        elasticsearch: {
            host: process.env.ELASTICSEARCH_HOST || "http://localhost:9200",
            apiVersion: "6.8"
        }
    },

    actions: {
        addItem: {
            params: {
                productId: 'string',
                quantity: 'number',
            },
            async handler(ctx) {

                try {
                    const { productId, quantity, userId } = ctx.params;
                    let cart = await this.findCart({userId : userId});
                    console.log(cart)
                    if (!cart) {
                        console.log(true)
                        return await this.addCart(userId, productId, quantity)
                    }
                    else {
                        console.log(false)
                       let update = await this.pushProduct(userId, productId, quantity)
                        if (update.result === "updated") {
                            ctx.meta.$statusCode = 200;
                            return {result: "the product add to your cart"}
                        }

                    }

                } catch (e) {
                    console.log(e)
                    ctx.meta.$statusCode = 400;
                    return {error: "try it again"}
                }



            },
        },
        getCart: {
            params: {
                userId: 'string',
            },
            async handler(ctx) {

                try {

                    const { userId } = ctx.params;
                    console.log(userId , "asdasdas")
                    let cart = await this.findCart({userId : userId});
                    if (cart) {
                        return cart
                    }
                    else {
                        ctx.meta.$statusCode = 404;
                        return {error : "cart not found"}
                    }

                }
                catch (e) {
                    console.log(e)
                    ctx.meta.$statusCode = 400;
                    return {error: "try it again"}
                }



            },
        },
        addPayment: {
            params: {
                userId: 'string',
                paymentId: 'string',
            },
            async handler(ctx) {
                const { userId, paymentId } = ctx.params;
                let cart = await this.findCart({userId : userId});
                if (cart) {
                    return await this.pushPaymentId(cart._id, paymentId);
                } else {
                    ctx.meta.$statusCode = 404;
                    return {error : "cart not found"}
                }

            },
        },
        checkout: {
            params: {
                userId: 'string',
            },
            async handler(ctx) {
                const { userId } = ctx.params;
                let cart = null;
                try {
                    cart = await this.findCart({userId : userId});
                    if (!cart) {
                        throw new Errors.MoleculerClientError('cart not found');
                    }
                } catch (e) {
                    throw e;
                }

                if (cart._source.paymentId === "") {
                    throw new Errors.MoleculerClientError('Missing payment ID for checkout');
                }

                const statusItem = await this.getStatus(userId);
                if (statusItem && statusItem.status === 'started') {
                    throw new Errors.MoleculerClientError(`Checkout is already in progress for user: ${userId}`);
                }

                try {
                    const amount = await ctx.call('pricing.calculate', { userId });
                    const status = await this.createStatus(userId, cart._source.paymentId);
                    console.log(status)

                    if (status) {
                        await ctx.emit('cart.checkout', {
                            userId,
                            paymentId: cart._source.paymentId,
                            amount,
                            item : cart._source.item
                        });
                        return {status : 'started'}

                    }
                } catch (e) {
                    throw e;
                }
            },
        },
        getOrderStatus: {
            params: {
                userId: 'string',
            },

            async handler(ctx) {
                const { userId } = ctx.params;

                const orders = await this.getOrders({ userId: userId });
                if (orders) {
                    return orders.hits.hits;
                } else {
                    return null;
                }
            },
        }
    },

    events: {
            async 'cart.payment-completed'(ctx)  {
                let payment_status = "payment-completed"

                const { payload } = ctx.params;
                let order = await this.createOrder(payload , payment_status)
                if (order) {
                    await this.deleteCart(payload.userId)
                    await this.deleteStatus(payload.userId)
                     await ctx.emit('cart.checkout-complete', { order });
                }
        },
        async 'cart.payment-failed'(ctx) {
                console.log('cart.payment-failed')
            let payment_status = "payment-failed"
                const { payload } = ctx.params;
                let order = await this.createOrder(payload , payment_status )
                await this.deleteStatus(payload.userId)
                await ctx.emit('cart.checkout-delete', { order });
        },
    },

    methods: {
        async findCart(userId) {
            return new Promise(async (resolve, reject) => {
                try {
                    console.log(userId , "userId")
                    let cart = await this.client.search({
                        index : 'cart',
                        type: 'doc',
                        body: {
                            query: {
                                match_phrase: userId
                            }
                        }
                    })
                    if (cart.hits.hits.length !== 0) {
                        resolve(cart.hits.hits[0])
                    }
                    else {
                        resolve(null)
                    }
                } catch (e) {
                    console.log(e)
                    resolve(null)
                    }
            })
        },
        async deleteCart(userId) {
            return new Promise(async (resolve, reject) => {
                try {
                    let cart = await this.client.delete({
                        index : 'cart',
                        type: 'doc',
                        id: userId
                    })
                    resolve(true)
                } catch (e) {
                    resolve(false)
                    }
            })
        },
        async addCart(userId, productId, quantity) {
            return new Promise(async (resolve, reject) => {
                try {
                    let cart = await this.client.create({
                        index : 'cart',
                        id : userId,
                        type : "doc",
                        body: {
                            userId: userId ,
                            paymentId : "",
                            item: [
                                {
                                    productId: productId,
                                    quantity: quantity
                                }
                            ]
                        }
                    })
                    console.log(cart , "xxx")
                    resolve(cart)
                } catch (e) {
                    if (e.status === 409) reject({error: "duplicate cart", status : 400 , code : 409})
                }
            })


        },
        async pushProduct( userId, productId, quantity) {
          try {
              return await this.client.update({
                  index: "cart",
                  type: "doc",
                  id: userId,
                  body: {
                      script: {
                          "inline": "ctx._source.item.add(params.item)",
                          "lang": "painless",
                          "params": {
                              "item": {
                                  productId: productId,
                                  quantity: quantity
                              }
                          }
                      },
                  }
              })
          }catch (e) {
              console.log(e)
          }
        },
        async pushPaymentId( cartId, paymentId) {
          try {
              return await this.client.update({
                  index: "cart",
                  type: "doc",
                  id: cartId,
                  body: {
                          doc: {
                              paymentId: paymentId
                          }
                  }
              })
          }catch (e) {
              console.log(e)
          }
        },
        async getStatus(userId) {
          try {
              return await this.client.search({
                  index : 'status',
                  type: "cart-status",
                  body: {
                      query: {
                          match_phrase: {
                              "userId" : userId
                          }
                      }
                  }
              })
          }catch (e) {
              console.log(e)
          }
        },
        async createStatus(userId, paymentId) {
            return new Promise(async (resolve, reject) => {
                try {
                    let status = await this.client.create({
                        index : 'status',
                        id:  userId,
                        type: "cart-status",
                        body: {
                            userId: userId,
                            paymentId : paymentId,
                            status : "started"
                        }
                    })
                    if (status) {
                        resolve(status)
                    }
                    else {
                        resolve(null)
                    }
                }catch (e) {
                    resolve(e)

                }
            }).catch((e) => {
                console.log(e)

            })


        },
        async createOrder(payload , payment_status) {
          try {
              console.log(payment_status)
              return await this.client.create({
                  index : 'order',
                  id: uuidv4(),
                  type: "doc",
                  body: {
                      userId: payload.userId,
                      payment_status: payment_status,
                      amount: payload.amount,
                      paymentId : payload.paymentId,
                      status : payload.status,
                      item: payload.item,
                      reference: uuidv4(),

                  }
              })
          }catch (e) {
              console.log(e)
          }
        },
        async deleteStatus(userId) {
          try {
              return await this.client.delete({
                  index : 'status',
                  type: "cart-status",
                  id: userId
              })
          }catch (e) {
              console.log(e)
          }
        },
        async getOrders(query) {
            return new Promise(async (resolve, reject) => {
                try {
                    const orders = await this.client.search({
                        index : 'order',
                        type: "doc",
                        body: {
                            query: {
                                match_phrase: query
                            }
                        }
                    })
                    resolve(orders)
                }catch (e) {
                    reject(e)

                }
            }).catch((e) => {
                console.log(e)

            })


        },


    },
};
