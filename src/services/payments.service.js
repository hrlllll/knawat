module.exports = {
  name: 'payments',
  events: {
    'cart.checkout': {
      async handler(ctx) {
          try {
          const { userId, paymentId, amount, item } = ctx.params;
          const payload = { userId, paymentId, amount , item};
          if (Math.random() > 0.5) {
             await ctx.emit('cart.payment-completed', {payload})
          } else {

            await ctx.emit('cart.payment-failed', { payload });
          }
        }catch (e) {
            console.log(e)
        }

      },
    },
  },
};


