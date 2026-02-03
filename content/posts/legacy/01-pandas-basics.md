---
date: 2023-04-23
tags: [pandas, data-analysis, python]
legacy: true
---

# Pandas Basics: Core Objects & Common Operations

```python
import pandas as pd
import numpy as np

# 创建一个最简单的 Series：不指定索引时，会自动使用0,1,2,...作为索引
s1 = pd.Series([10, 20, 30, 40])
print(s1)
# 输出:
# 0    10
# 1    20
# 2    30
# 3    40
# dtype: int64

# 创建 Series 时指定索引
s2 = pd.Series([100, 98, 67, 23], index=['zs', 'ls', 'ww', 'sl'])
print(s2)
# 输出:
# zs    100
# ls     98
# ww     67
# sl     23
# dtype: int64
# 这是一个 Series：左边是索引(index)，右边是对应的值，dtype 表示值的数据类型

# 通过字典创建 Series，键会成为索引，值成为数据
d = {'zs': 100, 'ls': 98, 'ww': 67, 'sl': 23}
s3 = pd.Series(d)
print(s3)
# 输出与上面 s2 相同（字典键的插入顺序即索引顺序）
```

上面代码展示了三种创建 Series 的方式：直接由列表创建（可以指定索引，也可以不指定用默认索引0,1,2,…），以及由字典创建。一般来说，通过列表创建可以灵活指定索引顺序，而通过字典创建会使用字典的键作为索引（顺序为插入顺序）。两者效果类似，都得到一个带索引的一维数据序列。

还有一种快捷方式，如果想要创建内容全部相同的 Series，可以直接传入一个常数值和索引。例如下面代码将生成10个元素都为0.2的Series：

```python
# 创建一个包含10个0.2的 Series
s4 = pd.Series(0.2, index=range(10))
print(s4.head(3))  # 先看头3行
# 输出:
# 0    0.2
# 1    0.2
# 2    0.2
# dtype: float64
```

可以看到，s4的每个元素都是0.2，指数0到9。head(3)方法返回前3行，便于我们预览数据。

### Series 的数据访问

Series 有点类似于 Python 的列表和字典的结合，在访问数据时既可以用位置下标也可以用标签索引。需要注意的是：Series同时支持基于位置和基于标签的索引方式，这两套索引彼此独立。

- 位置索引（下标）：按照元素的位置顺序，从0开始计数。例如 s[0] 取第一个元素，s[1:3] 取切片。
- 标签索引（index）：按照我们定义的索引值来取。例如索引是字符串 ‘zs’，用 s['zs'] 来取对应的值。

下面用具体例子说明 Series 的两种索引方法：

```python
s = pd.Series([100, 78, 98, 79], index=['zs', 'ls', 'ww', 'sl'])
# 这个 Series 的索引为 'zs','ls','ww','sl'，对应的值如列表所给

# 按位置索引访问
print(s[3])      # 第4个元素，位置从0开始计数
print(s[:2])     # 前2个元素的切片（不包含位置2）
print(s[[0, 2]]) # 位置0和2的元素，返回一个新的 Series

# 按标签索引访问
print(s['sl'])              # 索引标签为 'sl' 的元素
print(s['zs':'ww'])         # 按标签切片，包含 'zs' 到 'ww'（注意包含末端）
print(s[['zs', 'ww', 'sl']])# 指定标签列表，返回多个元素
```

上述代码中，s[3] 通过位置获取到了第4个元素 79，而 s['sl'] 则通过标签获取到了对应的值 79。区别：切片时，s[:2]按位置取不包括索引2，而 s['zs':'ww']按标签取则是包含 'ww' 这个索引的（也就是包含切片区间的末端）。这点与 Python 基本切片规则不同，需要特别注意。

另外，Series 不支持像 Python 列表那样的负索引。也就是说，s[-1] 并不能取最后一个元素（除非你的索引恰好有 -1 这个标签）。如果需要取最后一个元素，可以使用 s.iloc[-1]（iloc 是后面会介绍的按位置选取的通用方式）。总之，Series 的下标索引只有正向的，没有反向的。

我们还可以查看 Series 的一些属性来了解数据结构：

```python
print(s.index)   # Index(['zs', 'ls', 'ww', 'sl'], dtype='object')
print(s.values)  # [100  78  98  79]，值本身是一个 numpy.ndarray
print(s.dtype)   # int64，值的数据类型
print(s.shape)   # (4,)，Series 的形状，相当于长度为4的一维数组
print(s.size)    # 4，元素个数
print(s.ndim)    # 1，维度，对于Series永远是1
```

index 属性返回一个 Index 对象，包含 Series 的索引列表；values 则返回一个包含所有值的 NumPy 数组。在这个例子中，值全是整数，所以 dtype 是 int64。如果数据包含浮点或出现 NaN（缺失值），dtype 可能变为 float64。shape、size、ndim 等属性和 NumPy 的数组类似，分别表示数据的形状、元素数量和维度。

## DataFrame 是什么

DataFrame 是 Pandas 中更为常用的二维表结构，可以理解为“带行标签和列标签的表格数据”。如果说 Series 有点像 Excel 中的一列，那么 DataFrame 就像整个表格（由多列组成），同时拥有行索引（index）和列名（columns）。DataFrame 也可以看作由多个共享同一个索引的 Series 组成的字典，每一列是一个 Series，列名是字典的键。

举个例子，一个 DataFrame 可以用来表示多个人的若干属性，例如姓名、年龄、性别，每一列是一种属性，每一行代表一个人。我们可以使用多种方式来构造 DataFrame，常见的方法包括：由字典、由列表组成的列表、由多个 Series 等。下面通过代码来演示 DataFrame 的创建和基本属性。

```python
import pandas as pd

# 通过字典创建 DataFrame，每个键代表一列
data = {
    'Name': ['Tom', 'Jerry', 'Jack', 'Rose'],
    'Age': [18, 18, 20, 20]
}
df = pd.DataFrame(data)
print(df)
# 输出:
#    Name  Age
# 0   Tom   18
# 1 Jerry   18
# 2  Jack   20
# 3  Rose   20
```

上面用字典创建了一个简单的 DataFrame df，包含两列：Name 和 Age。因为我们没有指定索引，Pandas 自动用了默认的整数索引 0,1,2,3。可以看到 DataFrame 打印输出时，会显示行索引和列名，以及每个单元格的数据。

我们也可以指定自己的索引。例如，如果我们想用 a, b, c, d 作为每行的索引标签，可以传入参数 index= 来指定；另外用 columns= 可以指定列名的顺序。下面我们构造一个稍微复杂一点的 DataFrame：多加一列 Gender，并且让不同列来自不同长度的 Series，以演示 Pandas 会如何对齐数据。

```python
# 用字典包含多个 Series 来创建 DataFrame，各 Series 按索引自动对齐
data2 = {
    'Name': pd.Series(['Tom', 'Jerry', 'Jack', 'Rose'], index=['a', 'b', 'c', 'd']),
    'Age': pd.Series([18, 18, 20], index=['a', 'b', 'c']),      # 少了索引 'd'
    'Gender': pd.Series(['M', 'M', 'F'], index=['a', 'c', 'd']) # 少了索引 'b'
}
df2 = pd.DataFrame(data2)
print(df2)
# 输出:
#   Name   Age Gender
# a   Tom  18.0      M
# b Jerry  18.0    NaN
# c  Jack  20.0      F
# d  Rose   NaN      M
```

在这个 df2 DataFrame 中，我们指定了索引为 'a', 'b', 'c', 'd'。Name 列有这四个索引的值，但 Age 列缺少 'd'的值，Gender 列缺少 'b'的值。Pandas 会根据索引自动对齐不同列的数据：对于缺失的位置以 NaN 填充。上面输出中，索引 b 的 Gender 显示为 NaN（因为没有提供 b 对应的 Gender），索引 d 的 Age 为 NaN（没有提供 d 对应的 Age）。NaN 表示缺失值，在 Pandas 中是一种特殊的浮点型值。

> **注意**： 由上述例子也可以看出，DataFrame 中每列数据可以是不同类型（Name 是字符串，Age 是数字，Gender 是字符串）。当某列出现 NaN 时，该列会被Upcast为浮点型，因为 NaN 被视作浮点类型特殊值。例如 Age 列本来是整数，一旦出现 NaN，就变成了 float。

如果我们不想让某些值缺失，可以在创建 DataFrame 时提供完整的数据，对齐索引。或者创建后再手动填充缺失值。但这些属于后续处理范畴。

### DataFrame 的属性和基本操作

类似于 Series，DataFrame 提供了许多属性和方法方便我们了解数据集的总体情况：

- `df.index`：获取行索引(Index对象)。
- `df.columns`：获取列名(Index对象)。
- `df.values`：以二维 numpy 数组的形式获取表格中的值。
- `df.shape`：返回 (行数, 列数) 的元组。
- `df.dtypes`：获取每一列的数据类型。
- `df.size`：返回元素总数 (行数 × 列数)。
- `df.empty`：布尔值，表示 DataFrame 是否为空（没有任何数据）。
- `df.head(n)`：查看前 n 行数据（默认 n=5）。
- `df.tail(n)`：查看最后 n 行数据。
- `df.describe()`：对数值列进行统计汇总（计数、均值、标准差、最小值、四分位数等）。
- `df.T`：获取转置的 DataFrame（行列互换）。

举例来说，我们可以查看 df2 的一些基本信息：

```python
print(df2.index)    # Index(['a', 'b', 'c', 'd'], dtype='object')
print(df2.columns)  # Index(['Name', 'Age', 'Gender'], dtype='object')
print(df2.shape)    # (4, 3) -> 4 行 3 列
print(df2.dtypes)   
# Name      object
# Age      float64
# Gender    object
# dtype: object

print(df2.head(2))
#   Name   Age Gender
# a   Tom  18.0      M
# b Jerry  18.0    NaN

print(df2.describe())
#              Age
# count   3.000000
# mean   18.666667
# std     1.154701
# min    18.000000
# 25%    18.000000
# 50%    18.000000
# 75%    19.000000
# max    20.000000
```

这里我们看到：index 和 columns 列出了 DataFrame 的索引和列标签，shape说明有4行3列。dtypes表明 Name 和 Gender 是object类型（字符串），Age是float64。head(2)输出了前两行数据，describe()则对 Age 列给出了统计摘要（因为 Name 和 Gender 非数字列被自动忽略）。

了解了 Series 和 DataFrame 的基本结构，下面我们进入更具体的增删改查操作，以 DataFrame 为中心进行讲解。在以下示例中，我们将继续使用刚才创建的 df2 来演示。

## 列操作 CRUD

通常我们需要对 DataFrame 的列进行各种操作，例如读取某几列数据、添加新列、修改已有列或者删除列。DataFrame 在列操作上非常类似于 Python 的字典：把 DataFrame 当做一个字典的话，键就是列名，值是一列数据（一个 Series）。因此许多列操作可以类比为字典操作来记忆。

下面我们按照查（读取）、增（添加）、改（修改）、删（删除）的顺序，演示列的常见操作。

查（读取列）： DataFrame 可以通过列名来获取列数据。最简单的方式是使用方括号 `df['列名']`，这会返回一个 Series，包含该列的所有数据和对应的行索引。另外，也可以传入一个列名列表 `df[['列名1','列名2']]` 来一次获取多列数据（此时返回一个新的 DataFrame）。需要注意的是，不能直接使用切片 `df['col1':'col3']` 来选取多列，方括号中如果给的是切片会被解释为行切片（这是为了保持语义简单一致，方括号直接索引默认为列，切片符号默认为行切片，这点细节稍微有点反直觉）。

我们来看具体例子：

```python
df = df2  # 继续使用前面的 df2: 有 Name, Age, Gender 三列，索引 a,b,c,d

# 访问单列数据
name_col = df['Name']
print(name_col)           # 获取 Name 列（类型为 Series）

# 访问多列数据
subset = df[['Name', 'Age']]
print(subset)             # 获取 Name 和 Age 两列，返回 DataFrame

# 利用 df.columns 得到列名列表，比如去掉最后一列:
print(df[df.columns[:-1]])# 获取除最后一列外的所有列
```

输出（省略部分）将展示 name_col 是一个 Series，内容就是每个索引对应的 Name；而 subset 是一个 DataFrame，包含两列 Name 和 Age。最后一行通过 df.columns[:-1] 切片拿到了除最后一列（Gender）以外的列名列表，实现了获取多列的另一种方法。

值得一提的是，Pandas 允许通过属性访问的方式获取列，例如 df.Name 可以直接得到 Name 列，这跟 df['Name'] 是等价的（前提是列名是合法的 Python 标识符且不与现有属性方法同名）。但是如果列名包含空格或特殊字符，或者碰巧和 DataFrame 的方法名冲突，就不能用点属性访问。建议初学者还是使用 df[...] 这种明确的方式。

> **注意**： 如果列名中包含空格，比如 "Total Sales" 这种，不能用 df.Total Sales（会语法错误或解析错误），此时必须用 df['Total Sales'] 来访问。同样地，列名包含点号、减号等特殊字符，或列名叫max、count等与DataFrame方法重名，也只能使用 df['列名'] 的方式。如果想方便地用点访问，最好的办法是统一修改列名，例如用 `df.columns = df.columns.str.replace(' ', '_')` 将空格替换为下划线，或者使用 df.rename 重命名列。

增（添加列）： 向 DataFrame 增加新列也很直观：直接像字典赋值一样 `df['新列名'] = ...` 即可。赋值的“…”可以是以下几种：

- 一个固定值：则整列都会被这个值填充。
- 一个列表或 ndarray：长度需要跟 DataFrame 的行数相等，数据会按顺序填充这一列。
- 一个 Pandas 的 Series：如果 Series 的索引能对齐 DataFrame 的索引，那么会根据索引匹配填充，索引没有对应上的位置将出现 NaN。

也可以一次性添加多列。Pandas 提供了 pd.concat 方法，可以用来把两个DataFrame按列方向拼接（axis=1）从而增加新列。此外，df.assign() 方法也可以同时添加多列，不过这里不展开。下面通过代码演示各种添加列的方式：

```python
# 原始 DataFrame 回顾:
print(df)
#   Name   Age Gender
# a   Tom  18.0      M
# b Jerry  18.0    NaN
# c  Jack  20.0      F
# d  Rose   NaN      M

# 1. 直接赋值列表，添加一列
df['Math'] = [100, 100, 100, 100]   # 所有行的 Math 值都是100
print(df)
# 新增了 Math 列:
#   Name   Age Gender  Math
# a   Tom  18.0      M   100
# b Jerry  18.0    NaN   100
# c  Jack  20.0      F   100
# d  Rose   NaN      M   100

# 2. 赋值一个 Series，按索引对齐添加新列
df['English'] = pd.Series([95, 96, 97], index=['a', 'b', 'd'])
print(df)
# 新增 English 列（对齐索引，有缺失）:
#   Name   Age Gender  Math  English
# a   Tom  18.0      M   100     95.0
# b Jerry  18.0    NaN   100     96.0
# c  Jack  20.0      F   100      NaN  # c 没有 English 值，NaN
# d  Rose   NaN      M   100     97.0

# 3. 用 concat 横向拼接添加多列
new_cols = pd.DataFrame({
    'Chinese': [50, 50, 50, 50],
    'P.E.': [60, 60, 60, 60]
}, index=['a', 'b', 'c', 'd'])
df = pd.concat([df, new_cols], axis=1)
print(df)
# 新增了 Chinese 和 P.E. 两列:
#   Name   Age Gender  Math  English  Chinese  P.E.
# a   Tom  18.0      M   100     95.0      50    60
# b Jerry  18.0    NaN   100     96.0      50    60
# c  Jack  20.0      F   100      NaN      50    60
# d  Rose   NaN      M   100     97.0      50    60
```

上面的操作依次给 DataFrame 添加了 Math 列（所有值相同），English 列（只有索引 a,b,d 有值，c 自动补NaN），以及通过 pd.concat 一次拼接两个新列 Chinese 和 P.E.。需要留意的是，我们使用了 'P.E.' 作为列名，这里包含了一个点号，今后访问 P.E. 列就不能用 df.P.E.（会被解释成连续的属性访问而出错），只能用 df['P.E.']。这再次说明了列名命名的规范性重要性。

改（修改列）： 修改列的值实际上和添加列是一样的操作——用新的值赋值给已有的列名。如果该列存在，就会被新值覆盖；如果不存在，就会新建列。因此在语法上没有专门的“改列”方法，直接赋值即可。

例如，我们可以把刚刚添加的 Chinese 列的分数全部改成 100：

```python
df['Chinese'] = [100, 100, 100, 100]
print(df)
# Chinese 列的值已更新为100:
#   Name   Age Gender  Math  English  Chinese  P.E.
# a   Tom  18.0      M   100     95.0      100    60
# b Jerry  18.0    NaN   100     96.0      100    60
# c  Jack  20.0      F   100      NaN      100    60
# d  Rose   NaN      M   100     97.0      100    60
```

这里将 df['Chinese'] 直接赋值为新的列表，[100,100,100,100]，达到了修改整列的目的。同样地，你也可以只修改某几个值，比如使用按行索引的 .loc 来定位再赋值，这属于“行操作”范畴，我们稍后介绍。

删（删除列）： 删除 DataFrame 的列有多种方式：

- 使用 `del df['列名']`，就像删除字典键一样。
- 使用 `df.pop('列名')`，会返回被删除的列的 Series。
- 使用 `df.drop(columns=[...])` 或 `df.drop([...], axis=1)`，可以一次删除一列或多列。drop 默认返回一个新的 DataFrame，除非指定 inplace=True 原地删除。

下面依次演示用上述方法删除我们不需要的列：

```python
# 1. del 关键字删除列
del df['P.E.']
print(df.columns)  # Index(['Name', 'Age', 'Gender', 'Math', 'English', 'Chinese'], dtype='object')

# 2. pop 方法删除列
df.pop('Chinese')
print(df.columns)  # Index(['Name', 'Age', 'Gender', 'Math', 'English'], dtype='object')

# 3. drop 删除多列
df.drop(['Math', 'English'], axis=1, inplace=True)
print(df.columns)  # Index(['Name', 'Age', 'Gender'], dtype='object')
print(df)
#    Name   Age Gender
# a   Tom  18.0      M
# b Jerry  18.0    NaN
# c  Jack  20.0      F
# d  Rose   NaN      M
```

可以看到，先用 del 删掉了 P.E. 列，然后用 pop 删掉 Chinese 列，最后用 drop 一次性删掉 Math 和 English 列。删除后我们的 DataFrame 又只剩下最初的三列（Name, Age, Gender）以及原来的行索引。使用 drop 时记得加 axis=1 表示按列删除，并且可以根据需要选择是否 inplace。如果不使用 inplace，那么应当用 df = df.drop([...], axis=1) 赋值回去，因为 drop 默认返回删除指定列后的新 DataFrame。

## 行操作 CRUD

有时候我们需要对表格的行进行操作，例如按行查看数据、添加或删除某些行等。行的操作在 Pandas 中主要通过索引（index）来定位，分为按标签索引（index label）和按整数位置索引两大方式。

对行的“查、增、改、删”，我们分别介绍。继续使用前面的 DataFrame（目前有 Name, Age, Gender 列，索引 a, b, c, d），来演示行操作。

查（读取行）： 和列不同，直接使用 df[...] 的方括号不能直接按行标签取行。比如 df['a'] 并不会返回索引为 a 的那一行，而是试图取名为 ‘a’ 的列（通常不存在，会报错）。因此，Pandas 提供了专门的索引器属性：

- `df.loc[行标签]` 用行标签选取数据。
- `df.iloc[行号]` 用行位置（整数下标）选取数据。

这两个索引器非常重要：loc 基于标签，iloc 基于整数位置。使用它们我们可以非常灵活地按行或按行列组合选取数据。

loc 用法示例：

```python
# 使用 loc 按标签索引行
print(df.loc['a'])         # 索引为 'a' 的整行数据，返回一个 Series
print(df.loc['b':'c'])     # 从索引 'b' 到 'c' 的行（包括 'c' 行）
print(df.loc[['a', 'c'], ['Name', 'Gender']])
# 上面一行选取索引 a 和 c 的两行，且只取其中的 Name 和 Gender 两列
```

iloc 用法示例：

```python
# 使用 iloc 按位置索引行
print(df.iloc[0])          # 第 0 号位置的行（即索引 'a' 这一行）
print(df.iloc[1:3])        # 位置 1 到 2 的行（不包括位置3），对应索引 b, c 两行
print(df.iloc[[0, 2], [0, 2]])
# 上面一行选取位置 0 和 2 的两行，以及位置 0 和 2 的两列，实现行列交叉选取
```

loc 和 iloc 都可以接受单个索引、切片、列表等形式来选取多行/多列，非常灵活。需要注意几点：

- 用 loc 做标签切片时，区间两端都是闭区间，也就是包含结束标签。例如上例中 `df.loc['b':'c']` 包含 ‘c’ 行。
- 用 iloc 做位置切片则和 Python 列表切片规则一致，左闭右开，不包含结束的索引位置。
- iloc 允许索引列表中有重复值或顺序打乱，这种情况下会相应返回重复或乱序的行。这在需要根据位置重复数据时可能有用。
- 如果 DataFrame 的索引是数字且你用 df[some_number] 直接索引，Pandas会优先尝试按标签解析（因为索引可能正好是那个数字）。因此当索引是数字时，要特别注意区分 loc（按标签）和默认的[]行为。最安全的做法是始终使用 loc 或 iloc 来取行，避免歧义。

增（添加行）： DataFrame 添加行相对没有添加列那么直接。以往 Pandas 有 df.append() 方法可以直接添加一行新的数据，但自 Pandas 1.4 起该方法已被废弃，官方建议使用 pd.concat 来完成这一功能。

添加新行的思路是：先构造一个与原 DataFrame 列结构相同的 DataFrame 或 Series，然后通过 `pd.concat([...], axis=0)` 将其与原 DataFrame 按行拼接。注意保持新行的数据在列上的对齐。下面演示添加一行数据：

```python
# 构造一行新数据，注意列名需与原 DataFrame 一致
new_row = pd.DataFrame([['ZhangSan', 21, 'M']], 
                       columns=['Name', 'Age', 'Gender'], 
                       index=['e'])
# 用 concat 连接新行
df = pd.concat([df, new_row], axis=0)
print(df)
# 输出:
#    Name   Age Gender
# a    Tom  18.0      M
# b  Jerry  18.0    NaN
# c   Jack  20.0      F
# d   Rose   NaN      M
# e ZhangSan 21.0      M
```

上面我们添加了一行索引为 ‘e’ 的数据，Name 为 ZhangSan，Age 为21，Gender 为 M。拼接后可以看到 df 多了一行 ‘e’。如果不指定 index=['e']，new_row 会默认用0作为索引，与原 DataFrame 的索引类型不一致甚至冲突。在这种情况下 concat 仍会成功（它不会因为索引重复而报错），但新行索引会是0，有可能与原有索引冲突导致两个索引相同。这通常不是我们想要的，所以指定一个不会重复的新索引比较安全。

改（修改行）： 修改行通常可以通过 loc 或 iloc 来定位整行然后赋值。例如，我们把刚才添加的 ‘e’ 行数据的 Name 和 Age 修改一下：

```python
df.loc['e'] = ['Peter', 22.0, 'M']  # 将索引 'e' 的整行重置为新的值
print(df.loc['e'])
# 输出:
# Name      Peter
# Age        22.0
# Gender        M
# Name: e, dtype: object
```

我们成功地把索引 e 那行的数据更新为 Name = Peter, Age = 22.0, Gender = ‘M’。这里直接对 df.loc['e'] 赋予一个列表，新值会按照列的顺序填入对应的三个列。如果只想修改某个单元格，也可以使用 `df.at[row_index, col_name] = value` 或 `df.iat[row_position, col_position] = value` 来定位赋值。

删（删除行）： 删除行使用 drop 方法，指定 axis=0（或者不指定，默认就是0也表示按行删）。可以传入要删除的索引标签列表。与删除列类似，drop 默认返回新对象，除非设置 inplace=True。示例：

```python
# 删除索引为 'b' 和 'd' 的两行
df = df.drop(['b', 'd'], axis=0)
print(df)
# 输出:
#    Name   Age Gender
# a   Tom  18.0      M
# c  Jack  20.0      F
# e Peter  22.0      M
```

索引 b 和 d 的行被删除了。可以看到现在 DataFrame 只剩下 a, c, e 三行数据。如果索引是默认的整数且希望按位置删除第几行，也可以直接传索引值（因为默认索引标签就是数字）。例如 df.drop([0], axis=0) 会删除索引为0的行。但是一旦索引不是默认整序，还是应该用标签。另外，如果想按条件删除（比如删除 Age 大于20的行），可以构造一个布尔型索引掩码然后用 `df.drop(df[condition].index, axis=0)` 实现，这里不展开。

## CSV 文件读写实践

数据通常保存在文件中，Pandas 支持读取和保存多种格式的数据文件，其中CSV（Comma-Separated Values）是最常见的文本格式。下面我们介绍 Pandas 如何高效地读取CSV，以及一些常用参数和技巧。同样，写回CSV也非常简单。

读取 CSV： 使用 pd.read_csv 函数即可读取CSV文件，基本用法是传入文件路径，Pandas 会自动将其解析为 DataFrame。示例：

```python
import pandas as pd

# 基本读取（假设 CSV 第一行为表头）
df = pd.read_csv('data.csv')
print(df.head(5))  # 查看前5行
```

如果CSV文件包含表头（第一行是列名），pd.read_csv 会自动将其作为列名。如果CSV没有表头行，我们需要告诉函数不要将第一行当作列名，可以使用 header=None，同时通过 names= 指定列名列表。例如：

```python
# 如果 CSV 没有表头行，指定 header=None 并提供列名
df = pd.read_csv('data_no_header.csv', header=None, names=['col1', 'col2', 'col3'])
```

read_csv 还有许多有用的参数，常用的包括：

- sep：指定分隔符，默认是逗号,。如果是制表符分隔的文件，可以用 sep='\t'。
- header：用来指定哪一行作为列名。如果第一行是数据而非列名，用 header=None。
- names：当没有表头或者想自行指定列名时，用这个参数传入列表作为列名。
- index_col：指定将某一列读入时设置为行索引。例如 index_col='Date' 会将”Date”那列作为索引而不是普通数据列。
- usecols：可以传入一个列名列表，表示只读取这些列，忽略其他列。对于很大的文件，读取必要的列可以明显加快速度、节省内存。
- dtype：可以指定列的数据类型，比如将某列强制读成字符串 dtype={'col': str}。正确指定类型也有助于加快读取和减少内存占用。
- nrows：只读取前 n 行，用于预览大型文件或测试。
- encoding：指定文件编码，比如中文常用 encoding='utf-8'（默认）、'gbk' 等。
- engine：解析引擎，一般不用特别指定。只有在分隔符比较特殊（例如多字符）时，会用到 engine='python'。


我们将上述一些参数综合在一个例子里：假设有一个文件包含股票数据，没有列名，我们想读取其中的日期(date)作为索引，以及开盘价(open)、最高价(high)、最低价(low)、收盘价(close)这几列。文件用逗号分隔。读取代码可以这么写：

```python
df = pd.read_csv('aapl.csv',
                 sep=',',         # 分隔符为逗号
                 header=None,     # 文件中无表头行
                 names=['name', 'date', '_', 'open', 'high', 'low', 'close', 'volume'],  # 列名列表
                 index_col='date',# 将"date"列作为行索引
                 usecols=['date', 'open', 'high', 'low', 'close']  # 只读取需要的五列
)
print(df.head(3))
# 输出示例:
#             open    high     low   close
# date
# 2011-01-28  344.17  344.40  333.53  336.10
# 2011-01-31  335.80  340.04  334.30  339.32
# 2011-02-01  341.30  345.65  340.98  345.03
```

在这个例子中，我们通过 names 提供了8个列名（文件每行有8个字段，其中第三个字段我们命名为_表示我们不关心），然后用 usecols 选择了我们想要的5列数据（date 和 OHLC 四列），并将 date 列设为索引。head(3) 打印输出验证了读取效果。使用 usecols 有效避免了读取不需要的数据，提高了速度。

> **常见问题**： *“如果 CSV 有五万行，那么用 Pandas 读会不会很慢、很卡？”*
>
> **答案是：不会**。 五万行对 Pandas 而言不算很多，一般几百毫秒就能读完。不过如果数据达到上百万行乃至更大，内存和耗时就需要考虑。这种情况下可以使用分块读取：pd.read_csv(..., chunksize=10000) 会返回一个可迭代的 TextFileReader，每次读取10000行，我们可以遍历每个chunk逐步处理。这样可以避免一次性占用太多内存。另一个方法是使用 dtype 精确指定类型，避免Pandas猜测类型的开销和潜在的不必要的高精度类型。总的来说，对于超大文件，分块读取并逐步处理是常用策略。

写出 CSV： 将 DataFrame 保存为 CSV 使用 DataFrame.to_csv 方法即可。例如：

```python
df.to_csv('output.csv', index=False)
```

上面代码将 DataFrame 写入当前目录下的 output.csv 文件，并设置 index=False 表示不保存行索引（因为有些情况下行索引没意义或者不要导出）。默认情况下 to_csv 会保存行索引和列标签，如果不想要可以分别用 index=False 和 header=False 关闭。to_csv 也支持 sep, encoding 等参数，自行根据需要设置即可。

除了 CSV 之外，Pandas 也支持读取/写入多种常见格式：

- Excel：使用 pd.read_excel('file.xlsx') 读取，DataFrame.to_excel('out.xlsx') 写入。注意读取 Excel 需要安装相应的引擎库，如 openpyxl。一般 .xlsx 文件都会用 openpyxl 引擎。
- JSON：使用 pd.read_json('file.json') 读取，DataFrame.to_json('out.json') 写出。read_json 可以通过参数 orient 来指定 JSON 的组织格式（比如记录为行还是列）。
- SQL：使用 pd.read_sql(query, connection) 可以从数据库读取查询结果为 DataFrame，to_sql 可以写入数据库表。（这需要SQLAlchemy等支持，这里略过）
- 以及其它格式例如 Parquet (read_parquet)、HTML表(read_html)、Stata (read_stata) 等等。

简单来说，Pandas 提供了一套统一的高层接口来读取和存储数据，让数据在不同媒介之间转移变得非常方便。你可以将其视为数据转换的瑞士军刀：CSV、Excel、JSON 转DataFrame，DataFrame再转回各种格式，都不是问题。

## 总结

Pandas 的两个核心数据结构：Series（一维带索引数组）和 DataFrame（二维表格）。在实际工程中，Pandas 可以大幅提高我们处理表格数据的效率。遇到“表格里的列名有空格”这样的细节问题，我们知道可以通过更换访问方式或重命名来解决；面对“怎样读大文件不卡”这样的性能问题，我们也了解了分块读取等方案。熟悉这些技巧能让我们更加游刃有余地使用 Pandas 处理数据。