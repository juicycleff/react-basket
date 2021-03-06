import React from 'react';
import { translate } from 'react-i18next';

import { BasketConsumer } from '../context';
import { generateUniqueId, validateBasket } from '../helpers';

import DefaultSpinner from '../spinner';
import {
  Outer,
  Label,
  Input,
  ButtonRegister,
  ButtonRegisterCancel,
  ButtonRegisterWrap,
  ButtonToggle,
  Feedback
} from './styles';

class CouponInner extends React.Component {
  state = {
    showInput: false,
    coupon: '',
    feedback: null
  };

  getInputRef = el => (this.inputRef = el);

  onCouponChange = e => this.setState({ coupon: e.target.value });

  onCouponKeyPress = e => {
    if (e.key === 'Enter') {
      this.register();
    }
  };

  register = async () => {
    const { t, actions, state, options } = this.props;
    const {
      setValidatingNewCoupon,
      setCoupon,
      setItems,
      setDiscount
    } = actions;
    const { items } = state;
    const { validateEndpoint } = options;

    const { coupon } = this.state;

    if (!coupon) {
      if (this.inputRef && this.inputRef.focus) {
        this.inputRef.focus();
      }

      this.setState({
        feedback: t('basket:fillOutCoupon')
      });
      return;
    }

    this.setState({
      feedback: null
    });

    setValidatingNewCoupon(true);

    try {
      const result = await validateBasket({
        items,
        coupon,
        validateEndpoint
      });

      if (result.error || result.status === 'INVALID') {
        this.setState({
          feedback: t('basket:couldNotVerifyCoupon', { coupon })
        });
        if (this.inputRef && this.inputRef.focus) {
          this.inputRef.focus();
        }
      } else {
        setCoupon(coupon);
        setItems(result.items);
        setDiscount(result.discount);
      }
    } catch (error) {
      console.warn(error); // eslint-disable-line
    }

    setValidatingNewCoupon(false);
  };

  showInput = () =>
    this.setState({ showInput: true }, () => {
      if (this.inputRef && this.inputRef.focus) {
        this.inputRef.focus();
      }
    });

  hideInput = () =>
    this.setState({ showInput: false, feedback: null, coupon: '' });

  render() {
    const { showInput, coupon, feedback } = this.state;
    const { SpinnerCmp = DefaultSpinner, t, state } = this.props;
    const { validatingNewCoupon } = state;

    // A coupon has already been registered
    if (state.coupon) {
      return null;
    }

    if (showInput) {
      const id = generateUniqueId('coupon-input');
      return (
        <Outer>
          <Label htmlFor={id}>{t('basket:inputCoupon')}</Label>
          <Input
            id={id}
            ref={this.getInputRef}
            innerRef={this.getInputRef}
            value={coupon}
            onChange={this.onCouponChange}
            onKeyPress={this.onCouponKeyPress}
            readOnly={validatingNewCoupon}
            placeholder={t('basket:inputCouponPlaceholder')}
            autoComplete="off"
          />
          <ButtonRegisterWrap>
            {feedback && <Feedback>{feedback}</Feedback>}
            <ButtonRegister
              type="button"
              onClick={this.register}
              disabled={validatingNewCoupon}
            >
              {t('basket:registerCoupon')}
            </ButtonRegister>
            {validatingNewCoupon && <SpinnerCmp size="12" />}
            <ButtonRegisterCancel>
              <ButtonToggle onClick={this.hideInput}>
                {t('basket:cancel')}
              </ButtonToggle>
            </ButtonRegisterCancel>
          </ButtonRegisterWrap>
        </Outer>
      );
    }

    return (
      <Outer>
        <ButtonToggle onClick={this.showInput}>
          {t('basket:clickToAddCoupon')}
        </ButtonToggle>
      </Outer>
    );
  }
}

export const Coupon = translate(['common', 'basket'])(outerProps => (
  <BasketConsumer>
    {props => <CouponInner {...props} {...outerProps} />}
  </BasketConsumer>
));
