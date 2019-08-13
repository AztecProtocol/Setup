import { createHash } from 'crypto';
import { MpcServer } from 'setup-mpc-common';
import request from 'supertest';
import { Account } from 'web3x/account';
import { bufferToHex, hexToBuffer } from 'web3x/utils';
import { app as appFactory } from './app';

type Mockify<T> = { [P in keyof T]: jest.Mock<{}> };

describe('app', () => {
  const account = Account.fromPrivate(
    hexToBuffer('0xf94ac892bbe482ca01cc43cce0f467d63baef67e37428209f8193fdc0e6d9013')
  );
  let app: any;
  let mockServer: Mockify<MpcServer>;

  beforeEach(() => {
    mockServer = {
      getState: jest.fn(),
      resetState: jest.fn(),
      updateParticipant: jest.fn(),
      downloadData: jest.fn(),
      uploadData: jest.fn(),
    };
    app = appFactory(mockServer as any, undefined, 32);
  });

  describe('GET /', () => {
    it('should return 200', async () => {
      const response = await request(app.callback())
        .get('/')
        .send();
      expect(response.status).toBe(200);
    });
  });

  describe('PUT /data', () => {
    it('should return 401 with no signature header', async () => {
      const response = await request(app.callback())
        .put(`/data/${account.address}/0`)
        .send();
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/X-Signature/);
    });

    it('should return 401 with transcript number out of range', async () => {
      const response = await request(app.callback())
        .put(`/data/${account.address}/30`)
        .set('X-Signature', 'placeholder')
        .send();
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/out of range/);
    });

    it('should return 401 with bad signature', async () => {
      const body = 'hello world';
      const badSig =
        '0x76195abb935b441f1553b2f6c60d272de5a56391dfcca8cf22399c4cb600dd26188a4f003176ccdf7f314cbe08740bf7414fadef0e74cb42e94745a836e9dd311d';

      const response = await request(app.callback())
        .put(`/data/${account.address}/0`)
        .set('X-Signature', badSig)
        .send(body);
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/does not match X-Signature/);
    });

    it('should return 429 with body length exceeding limit', async () => {
      const body = '000000000000000000000000000000000';

      const response = await request(app.callback())
        .put(`/data/${account.address}/0`)
        .set('X-Signature', 'placeholder')
        .send(body);
      expect(response.status).toBe(429);
      expect(response.body.error).toMatch(/Stream exceeded/);
    });

    it('should return 200 on success', async () => {
      const body = 'hello world';
      const hash = createHash('sha256')
        .update(body)
        .digest();
      const sig = account.sign(bufferToHex(hash));

      const response = await request(app.callback())
        .put(`/data/${account.address}/0`)
        .set('X-Signature', sig.signature)
        .send(body);
      expect(response.status).toBe(200);
    });
  });

  //   it('should return list of hotels', async () => {
  //     mockHotels.getHotelsData.mockImplementation(() => hotels);

  //     const response = await request(mockApp.callback())
  //       .get('/hotels')
  //       .set('auth-token', 'access-key')
  //       .send();

  //     expect(response.status).toBe(200);
  //     expect(response.body.data).toEqual([{ hid: '1234', apiKey: 'my_api_key', partners: { wihp: { id: '185070' } } }]);
  //   });
  // });

  // describe('GET /hotels/:apiKey', () => {
  //   it('should return 401 for wrong token send', async () => {
  //     const response = await request(mockApp.callback())
  //       .get('/hotels')
  //       .set('auth-token', 'not-the-access-key')
  //       .send();
  //     expect(response.status).toBe(401);
  //   });

  //   it('should return data for hotel', async () => {
  //     mockHotels.getHotelData.mockImplementation((apiKey: string) => find(hotels, { apiKey }));

  //     const response = await request(mockApp.callback())
  //       .get('/hotels/my_api_key')
  //       .set('auth-token', 'access-key')
  //       .send();

  //     expect(response.status).toBe(200);
  //     expect(response.body.data).toEqual({ hid: '1234', apiKey: 'my_api_key', partners: { wihp: { id: '185070' } } });
  //   });
  // });

  // describe('PUT /hotels/:apiKey', () => {
  //   it('should return 401 for wrong token send', async () => {
  //     const response = await request(mockApp.callback())
  //       .put('/hotels/my_api_key')
  //       .set('auth-token', 'not-the-access-key')
  //       .send();
  //     expect(response.status).toBe(401);
  //   });

  //   it('should return 400 for wrong content-type', async () => {
  //     const response = await request(mockApp.callback())
  //       .put('/hotels/my_api_key')
  //       .set('auth-token', 'access-key')
  //       .type('text/plain')
  //       .send();
  //     expect(response.status).toBe(400);
  //   });

  //   it('should return new data for hotel', async () => {
  //     mockHotels.setHotelData.mockImplementation((data: HotelData) => {
  //       hotels.unshift(data);
  //     });
  //     mockHotels.getHotelData.mockImplementation((apiKey: string) => find(hotels, { apiKey }));

  //     const newHotel: HotelData = {
  //       clientName: 'client',
  //       hotelName: 'hotel',
  //       model: { cpc: { monthlyBudgetUsd: { google: 100, total: 100 } } },
  //       hid: '1234',
  //       apiKey: 'my_new_api_key',
  //       partners: { wihp: { id: '185070' } },
  //       audienceListIds: [],
  //     };

  //     const putResponse = await request(mockApp.callback())
  //       .put('/hotels/my_new_api_key')
  //       .set('auth-token', 'access-key')
  //       .type('application/json')
  //       .send(newHotel);

  //     expect(putResponse.body).toEqual({ status: 'ok', data: newHotel });
  //     expect(putResponse.status).toBe(200);
  //     expect(mockHotels.setHotelData).toHaveBeenCalledTimes(1);

  //     const response = await request(mockApp.callback())
  //       .get('/hotels/my_new_api_key')
  //       .set('auth-token', 'access-key')
  //       .send();

  //     expect(response.status).toBe(200);
  //     expect(response.body.data).toEqual(newHotel);
  //   });

  //   it('should validate cpc channel budgets do not exceed total', async () => {
  //     const newHotel: HotelData = {
  //       clientName: 'client',
  //       hotelName: 'hotel',
  //       model: { cpc: { monthlyBudgetUsd: { google: 100, total: 99 } } },
  //       hid: '1234',
  //       apiKey: 'my_new_api_key',
  //       partners: { wihp: { id: '185070' } },
  //       audienceListIds: [],
  //     };

  //     const putResponse = await request(mockApp.callback())
  //       .put('/hotels/my_new_api_key')
  //       .set('auth-token', 'access-key')
  //       .type('application/json')
  //       .send(newHotel);

  //     expect(putResponse.body).toEqual({
  //       status: 'error',
  //       error: { reason: 'Sum of monthly budgets for channels cannot exceed total.' },
  //     });
  //     expect(putResponse.status).toBe(400);
  //     expect(mockHotels.setHotelData).not.toHaveBeenCalled();
  //   });
  // });

  // describe('GET /wihp/:wihpId/hotel', () => {
  //   it('should return 401 for wrong token send', async () => {
  //     const response = await request(mockApp.callback())
  //       .get('/hotels')
  //       .set('auth-token', 'not-the-access-key')
  //       .send();
  //     expect(response.status).toBe(401);
  //   });

  //   it('should return list of hotels', async () => {
  //     mockHotels.getHotelDataForWihpId.mockImplementation((wihpId: string) =>
  //       find(hotels, hotel => hotel.partners!.wihp!.id === wihpId)
  //     );

  //     const response = await request(mockApp.callback())
  //       .get('/wihp/185070/hotel')
  //       .set('auth-token', 'access-key')
  //       .send();

  //     expect(response.status).toBe(200);
  //     expect(response.body.data).toEqual({ hid: '1234', apiKey: 'my_api_key', partners: { wihp: { id: '185070' } } });
  //   });
  // });

  // describe('GET /api-keys', () => {
  //   it('should return 401 for wrong token send', async () => {
  //     const response = await request(mockApp.callback())
  //       .get('/hotels')
  //       .set('auth-token', 'not-the-access-key')
  //       .send();
  //     expect(response.status).toBe(401);
  //   });

  //   it('should return list of hotels', async () => {
  //     mockHotels.getApiKeys.mockImplementation(() => ['my_api_key']);

  //     const response = await request(mockApp.callback())
  //       .get('/api-keys')
  //       .set('auth-token', 'access-key')
  //       .send();

  //     expect(response.status).toBe(200);
  //     expect(response.body.data).toEqual(['my_api_key']);
  //   });
  // });

  // describe('GET /backup', () => {
  //   it('should call zappy for each hotel', async () => {
  //     mockHotels.getHotelsData.mockImplementation(() => hotels);
  //     const response = await request(mockApp.callback())
  //       .post('/backup')
  //       .set('auth-token', 'access-key')
  //       .send();
  //     expect(response.status).toBe(200);
  //     expect(mockTracker.updateHotelData).toHaveBeenCalledTimes(1);
  //   });
  // });
});
