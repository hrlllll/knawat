module.exports = {
  name: 'fulfilments',

  events: {

      'cart.checkout-complete'(payload) {
        console.log('checkout-complete ,Sending for fulfilment: ', payload);

      },
    'cart.checkout-delete'(payload) {
      console.log('checkout-failed , Sending for fulfilment: ', payload);
    },
  },
};
