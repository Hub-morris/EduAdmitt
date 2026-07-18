import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import api from '../api/client';

export async function registerBiometric() {
  const { data: options } = await api.get('/webauthn/register-options');
  const attResp = await startRegistration(options);
  const { data } = await api.post('/webauthn/verify-registration', attResp);
  return data.verified;
}

export async function loginBiometric() {
  const { data: options } = await api.get('/webauthn/auth-options');
  const authResp = await startAuthentication(options);
  const { data } = await api.post('/webauthn/verify-authentication', authResp);
  return data;
}
