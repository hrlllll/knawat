const HTTPServer = require('moleculer-web');
const E = require('moleculer-web').Errors;
const jwt = require("jsonwebtoken");

module.exports = {
  name: 'api-gateway',
  mixins: [HTTPServer],

  settings: {
    port: 9000,
    cors: {
      origin: '*',
    },
    routes: [
      {
        path: "/product",
        authorization: true,
        aliases: {
          'POST /add': 'product.add',
          'GET /get': 'product.get_all'
        },
      },
      {
        path: "/cart",
        authorization: true,
        aliases: {
          'POST /addItem': 'cart.addItem',
          'POST /addPayment': 'cart.addPayment',
          'POST /checkout': 'cart.checkout',
          'GET /getCart': 'cart.getCart',
          'GET /getOrderStatus': 'cart.getOrderStatus'
        },
      },
      {
        path: "/user",
        authorization: false,
        aliases: {
          'POST /login': 'user.login',
          'POST /register': 'user.register'
        },
      }
    ],
  },

  methods: {
    async authorize(ctx, route, req, res) {
      let auth = req.headers['x-auth-token'];
      if (auth && auth.startsWith('Bearer')) {
        let token = await auth.slice(6);
        const privateJWTKey = "1j3425n231t!$%#T^WGHrweyt2343"
        try {
          const decoded = await jwt.verify(token, privateJWTKey);
          if (decoded) {
            ctx.meta.$responseHeaders = {
              "userID": decoded._id
            };
            return Promise.resolve(ctx);
          }
          else {
            return Promise.reject(new E.UnAuthorizedError(E.ERR_INVALID_TOKEN));
          }
        } catch (e) {
          return Promise.reject(new E.UnAuthorizedError(E.ERR_INVALID_TOKEN));
        }

      }
      else {
        return Promise.reject(new E.UnAuthorizedError(E.ERR_NO_TOKEN));
      }
    },
  }
};
