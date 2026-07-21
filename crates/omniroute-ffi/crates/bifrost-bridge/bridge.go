package main

import "C"

//export bifrost_init
func bifrost_init() C.int { return 0 }

//export bifrost_chat
func bifrost_chat() C.int { return 0 }

//export bifrost_health
func bifrost_health() C.int { return 1 }
