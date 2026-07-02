import type { ClientConfig } from "./types";

export const demoClient: ClientConfig = {
  id: "san-diego-stucco",
  name: "Pacific Coast Stucco",
  industry: "Stucco contractor",
  location: {
    address: "1234 Harbor Dr",
    city: "San Diego",
    state: "CA",
    zip: "92101",
    lat: 32.7157,
    lng: -117.1611,
  },
  keywords: [
    "san diego stucco",
    "stucco repair san diego",
    "exterior plaster san diego",
    "stucco contractor near me",
    "stucco installation san diego",
  ],
  gbpPlaceId: "ChIJdemo-stucco-sd",
  website: "https://pacificcoaststucco.example.com",
  phone: "+1-619-555-0142",
};

export function getClientConfig(clientId: string): ClientConfig {
  if (clientId === demoClient.id) {
    return demoClient;
  }
  throw new Error(`Unknown client: ${clientId}`);
}

export function listClients(): ClientConfig[] {
  return [demoClient];
}
