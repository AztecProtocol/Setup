/**
 * Setup
 * Copyright Spilsbury Holdings 2019
 **/
#pragma once

#include <cassert>

// compiler should optimize this out in release builds, without triggering
// an unused variable warning
#define DONT_EVALUATE(expression)                                    \
   {                                                                 \
      true ? static_cast<void>(0) : static_cast<void>((expression)); \
   }

#ifdef NDEBUG
#define ASSERT(expression) DONT_EVALUATE((expression))
#else
#define ASSERT(expression) assert((expression))
#endif // NDEBUG