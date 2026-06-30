/**
 * samples.js — Pre-loaded Example Programs
 * Each sample demonstrates different language features and data flows.
 */

export const SAMPLES = [
  {
    name: "Hello World",
    description: "Basic print statement",
    code: `# Hello World — Your first program
message = "Hello, World!"
print(message)

# Numbers and math
x = 42
y = 3.14
print(f"The answer is {x}")
print(f"Pi is approximately {y}")`,
  },

  {
    name: "Variables & Math",
    description: "Arithmetic operations and variable tracking",
    code: `# Variables & Arithmetic Operations
a = 15
b = 7

# Basic operations
sum_ab = a + b
diff = a - b
product = a * b
quotient = a / b
remainder = a % b
power = a ** 2

print(f"{a} + {b} = {sum_ab}")
print(f"{a} - {b} = {diff}")
print(f"{a} * {b} = {product}")
print(f"{a} / {b} = {quotient}")
print(f"{a} % {b} = {remainder}")
print(f"{a}^2 = {power}")

# Compound assignment
total = 0
total += a
total += b
total *= 2
print(f"Total = {total}")`,
  },

  {
    name: "Fibonacci Sequence",
    description: "Loop-based Fibonacci with variable tracking",
    code: `# Fibonacci Sequence Generator
n = 10
a = 0
b = 1
count = 0

print("Fibonacci Sequence:")
while count < n:
    print(f"  F({count}) = {a}")
    temp = a + b
    a = b
    b = temp
    count += 1

print(f"Generated {n} numbers")`,
  },

  {
    name: "List Operations",
    description: "Create, modify, and iterate over lists",
    code: `# List Operations Demo
numbers = [5, 2, 8, 1, 9, 3]
print(f"Original: {numbers}")

# Add elements
numbers.append(7)
numbers.append(4)
print(f"After append: {numbers}")

# List info
size = len(numbers)
print(f"Length: {size}")

# Sum and average
total = 0
for num in numbers:
    total += num
average = total / size
print(f"Sum: {total}")
print(f"Average: {average}")

# Find max manually
largest = numbers[0]
for num in numbers:
    if num > largest:
        largest = num
print(f"Largest: {largest}")`,
  },

  {
    name: "Functions",
    description: "Function definitions, calls, and returns",
    code: `# Function Definitions & Calls

def greet(name):
    message = f"Hello, {name}!"
    return message

def add(x, y):
    result = x + y
    return result

def factorial(n):
    if n <= 1:
        return 1
    result = n * factorial(n - 1)
    return result

# Using functions
greeting = greet("Alice")
print(greeting)

total = add(10, 25)
print(f"10 + 25 = {total}")

fact5 = factorial(5)
print(f"5! = {fact5}")

fact7 = factorial(7)
print(f"7! = {fact7}")`,
  },

  {
    name: "String Processing",
    description: "String manipulation and formatting",
    code: `# String Processing
text = "Hello, Python World!"
print(f"Original: {text}")

# String operations
upper = text.upper()
lower = text.lower()
print(f"Upper: {upper}")
print(f"Lower: {lower}")

# Splitting
words = text.split(" ")
print(f"Words: {words}")
word_count = len(words)
print(f"Word count: {word_count}")

# Building strings
name = "World"
age = 25
info = f"Name: {name}, Age: {age}"
print(info)

# Character counting
length = len(text)
print(f"Character count: {length}")`,
  },

  {
    name: "Conditionals",
    description: "If/elif/else branching logic",
    code: `# Conditional Logic
score = 85

# Grade calculator
if score >= 90:
    grade = "A"
    msg = "Excellent!"
elif score >= 80:
    grade = "B"
    msg = "Good job!"
elif score >= 70:
    grade = "C"
    msg = "Not bad"
elif score >= 60:
    grade = "D"
    msg = "Needs improvement"
else:
    grade = "F"
    msg = "Please try again"

print(f"Score: {score}")
print(f"Grade: {grade}")
print(f"Comment: {msg}")

# Nested conditions
x = 42
if x > 0:
    if x % 2 == 0:
        parity = "positive even"
    else:
        parity = "positive odd"
else:
    parity = "non-positive"
print(f"{x} is {parity}")`,
  },

  {
    name: "Dictionary Demo",
    description: "Dictionary creation and operations",
    code: `# Dictionary Operations
student = {}
student["name"] = "Alice"
student["age"] = 20
student["grade"] = "A"
student["gpa"] = 3.8

print(f"Student: {student}")
print(f"Name: {student['name']}")
print(f"GPA: {student['gpa']}")

# Iterate over keys
keys = student.keys()
print(f"Fields: {keys}")

# Check membership
has_name = "name" in student
has_email = "email" in student
print(f"Has name: {has_name}")
print(f"Has email: {has_email}")

# Count entries
size = len(student)
print(f"Total fields: {size}")`,
  },

  {
    name: "Math Module",
    description: "Import and use the math library",
    code: `# Using the Math Module
import math

# Constants
pi = math.pi
print(f"Pi = {pi}")

# Square roots
num = 144
root = math.sqrt(num)
print(f"sqrt({num}) = {root}")

# Floor and ceiling
value = 7.6
floor_val = math.floor(value)
ceil_val = math.ceil(value)
print(f"floor({value}) = {floor_val}")
print(f"ceil({value}) = {ceil_val}")

# Calculate circle area
radius = 5
area = pi * radius ** 2
print(f"Circle area (r={radius}): {area}")`,
  },

  {
    name: "Bubble Sort",
    description: "Classic sorting algorithm with step tracking",
    code: `# Bubble Sort Algorithm
arr = [64, 34, 25, 12, 22, 11, 90]
n = len(arr)
print(f"Unsorted: {arr}")

swaps = 0
for i in range(n):
    for j in range(n - i - 1):
        if arr[j] > arr[j + 1]:
            temp = arr[j]
            arr[j] = arr[j + 1]
            arr[j + 1] = temp
            swaps += 1

print(f"Sorted: {arr}")
print(f"Total swaps: {swaps}")`,
  },

  {
    name: "Object-Oriented Programming",
    description: "Classes, objects, and methods in action",
    code: `# Object-Oriented Programming (OOP)
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def magnitude(self):
        import math
        return math.sqrt(self.x**2 + self.y**2)

    def scale(self, factor):
        self.x *= factor
        self.y *= factor

# Create object instances
v1 = Vector(3, 4)
print(f"Vector 1: ({v1.x}, {v1.y})")

# Call methods
mag1 = v1.magnitude()
print(f"Magnitude: {mag1}")

# Modify object state
print("Scaling by 2...")
v1.scale(2)
print(f"Scaled Vector: ({v1.x}, {v1.y})")
mag2 = v1.magnitude()
print(f"New Magnitude: {mag2}")`,
  },
];
