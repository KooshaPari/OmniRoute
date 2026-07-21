package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"context"
	"fmt"
	"sync"
	"unsafe"

	bifrost "github.com/maximhq/bifrost/core"
	"github.com/maximhq/bifrost/core/schemas"
)

var (
	bifrostInstance *bifrost.Bifrost
	bifrostMu       sync.Mutex
)

//export bifrost_init
func bifrost_init() C.int {
	bifrostMu.Lock()
	defer bifrostMu.Unlock()
	if bifrostInstance != nil {
		return 1
	}
	cfg := schemas.BifrostConfig{
		InitialPoolSize:    16,
		DropExcessRequests: false,
		Account:            &mockAccount{},
	}
	b, err := bifrost.Init(context.Background(), cfg)
	if err != nil {
		return -1
	}
	bifrostInstance = b
	return 0
}

//export bifrost_chat
func bifrost_chat(request_json *C.char, request_len C.int) *C.char {
	bifrostMu.Lock()
	b := bifrostInstance
	bifrostMu.Unlock()
	if b == nil {
		return C.CString(`{"error":"bifrost not initialized"}`)
	}
	reqBody := make([]byte, int(request_len))
	copy(reqBody, C.GoBytes(unsafe.Pointer(request_json), request_len))
	var chatReq schemas.BifrostChatRequest
	if err := json.Unmarshal(reqBody, &chatReq); err != nil {
		return C.CString(`{"error":"json parse failed"}`)
	}
	resp, err := b.ChatCompletionRequest(&schemas.BifrostContext{}, &chatReq)
	if err != nil {
		return C.CString(`{"error":` + fmt.Sprintf("%v", err) + `}`)
	}
	result, _ := json.Marshal(resp)
	return C.CString(string(result))
}

//export bifrost_health
func bifrost_health() C.int {
	bifrostMu.Lock()
	b := bifrostInstance
	bifrostMu.Unlock()
	if b == nil {
		return 0
	}
	return 1
}

func main() {}

// mockAccount implements schemas.Account with empty responses
type mockAccount struct{}

func (m *mockAccount) GetConfiguredProviders() ([]schemas.ModelProvider, error) {
	return nil, nil
}

func (m *mockAccount) GetKeysForProvider(_ context.Context, _ schemas.ModelProvider) ([]schemas.Key, error) {
	return nil, nil
}

func (m *mockAccount) GetConfigForProvider(_ schemas.ModelProvider) (*schemas.ProviderConfig, error) {
	return nil, nil
}
