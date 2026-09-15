// Mock for tls-client-node — native addon that Vite can't resolve at transform time.
const mockRequest = Object.assign(() => {}, { mock: true });
export default { request: mockRequest };
