export const enum MessageType {
  Error = 'error',
  Request = 'request',
  Response = 'response'
}

export type Message = {
  type: MessageType,
  data: any
};

export type ErrorMessageData = {
  message: string
};

export type RequestMessageData = {
  url: string
};

export type ResponseMessageData = {
  text: string
};
