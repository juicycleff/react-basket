import fetch from 'cross-fetch';
import isArray from 'isarray';

export const animationSpeedMs = 300;

export function getSupportedOptionsFromProps(props) {
  const {
    freeShippingMinimumPurchaseAmount = -1,
    validateEndpoint = '/api/basket/validate',
    onEmpty,
    onAddToBasket,
    onRemoveFromBasket,
    alwaysValidate
  } = props;

  return {
    freeShippingMinimumPurchaseAmount: parseFloat(
      freeShippingMinimumPurchaseAmount
    ),
    validateEndpoint,
    onEmpty,
    onAddToBasket,
    onRemoveFromBasket,
    alwaysValidate
  };
}

export const generateUniqueId = (function iife() {
  let idIncremenet = 0;

  return name => `crystallize-${name}-${idIncremenet++}`;
})();

export function createBasketItem({
  masterProduct,
  variant,
  metadata,
  subscription
}) {
  if (!masterProduct) {
    /* eslint-disable */
    console.error('Could not the create basket item without a master product!');
    /* eslint-enable */
    return {};
  }

  function getPriceWithVAT(price) {
    const vat = isNaN(masterProduct.vat) ? 0 : masterProduct.vat;
    return price * (1 + (vat || 0) / 100);
  }

  let vat = 0;
  if ('vat' in masterProduct) {
    ({ vat } = masterProduct);
    if (isArray(vat)) {
      [vat] = vat;
    }
    if (isNaN(vat) && vat) {
      vat = vat.percentage;
    }

    if (isNaN(vat)) {
      vat = 0;
    }
  }

  const basketItem = {
    masterId: masterProduct.id,
    name: masterProduct.name,
    sku: `${masterProduct.sku}-standard`,
    product_image: masterProduct.product_image,
    product_image_resized: masterProduct.product_image_resized,
    unit_price: getPriceWithVAT(masterProduct.price, vat),
    attributes: [],
    vat,
    metadata,
    subscription
  };

  if (!variant) {
    /* eslint-disable */
    console.warn(
      'Creating basket item without a variant. Deferring to -standard'
    );
    /* eslint-enable */
  } else {
    Object.assign(basketItem, {
      id: variant.id,
      sku: variant.variation_sku,
      attributes: variant.attributes
    });

    Object.assign(basketItem, {
      unit_price: getPriceWithVAT(variant.price_ex_vat)
    });

    if (variant.image) {
      Object.assign(basketItem, {
        product_image: isArray(variant.image)
          ? variant.image[0]
          : variant.image,
        product_image_resized: null
      });
    }
  }

  basketItem.reference = basketItem.sku;

  if (basketItem.subscription) {
    if (!basketItem.variationplan_id) {
      basketItem.variationplan_id = basketItem.subscription.variationplan_id;
    }
  }

  return basketItem;
}

const validateBasketRequest = async ({ validateEndpoint, basket }) => {
  let endpoint = validateEndpoint;

  if (validateEndpoint.startsWith('/')) {
    const l = window.location;
    endpoint = `${l.protocol}//${l.host}${validateEndpoint}`;
  }

  const response = await fetch(endpoint, {
    method: 'post',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(basket)
  });

  return response.json();
};

// Validate the basket if there is a coupon present.
export async function validateBasket({ validateEndpoint, items, coupon }) {
  let discount = null;

  if (items.length === 0) {
    return {
      coupon,
      items: [],
      totalAmount: 0,
      discount
    };
  }

  try {
    const result = await validateBasketRequest({
      validateEndpoint,
      basket: {
        items: items.filter(
          item => item.type !== 'discount' && item.type !== 'shipping'
        ),
        coupon: {
          code: coupon
        }
      }
    });

    if (result.status === 'INVALID') {
      return result;
    }

    const discountItem = result.find(item => item.type === 'discount');
    if (discountItem) {
      discount = discountItem.unit_price;
    }

    // Transform the cart items so that they are validated by Klarna
    const itemsTransformed = result
      .filter(item => item.type !== 'discount')
      .map(i => {
        const item = { ...i };

        item.tax_rate = item.tax_rate || item.vat || 0;
        item.discount_rate = item.discount_rate || 0;
        delete item.vat;

        return i;
      });

    // Calculate the total order value minus shipping and discount
    const totalAmount = itemsTransformed.reduce(
      (accumulator, item) => accumulator + item.unit_price * item.quantity,
      0
    );

    return {
      coupon,
      items: itemsTransformed,
      totalAmount,
      discount
    };
  } catch (error) {
    console.warn('@crystallize/react-basket', error); // eslint-disable-line

    return {
      error
    };
  }
}
