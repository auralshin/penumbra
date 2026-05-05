// Penumbra fixture — Go (tint: cyan)
package main

import (
	"errors"
	"fmt"
)

type User struct {
	ID     int
	Name   string
	Active bool
	Tags   []string
}

var ErrInactive = errors.New("inactive")

func (u *User) Greet() (string, error) {
	if !u.Active {
		return "", ErrInactive
	}
	return fmt.Sprintf("Hello, %s (%d tags)", u.Name, len(u.Tags)), nil
}

func main() {
	users := []*User{
		{ID: 1, Name: "Ada", Active: true, Tags: []string{"admin"}},
		{ID: 2, Name: "Grace", Active: false},
	}
	for _, u := range users {
		if msg, err := u.Greet(); err != nil {
			fmt.Printf("<%s: %v>\n", u.Name, err)
		} else {
			fmt.Println(msg)
		}
	}
}
